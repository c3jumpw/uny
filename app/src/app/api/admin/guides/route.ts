import { NextRequest, NextResponse } from "next/server";
import {
  requireContentAdmin,
  revalidateSite,
  slugify,
} from "@/lib/siteContent";

// Guides CRUD for /admin/guides.
//
// POST   create a draft
// PATCH  autosave, publish/unpublish, or rename a locked slug
// DELETE archive

const LIST_PATHS = ["/guides", "/get-started", "/"];

type Payload = Record<string, unknown>;

function str(v: unknown, max = 100000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export async function POST(req: NextRequest) {
  const auth = await requireContentAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { admin, user } = auth;

  const body = (await req.json().catch(() => ({}))) as Payload;
  const title = str(body.title, 300) ?? "Untitled guide";
  let slug = str(body.slug, 80) ?? slugify(title);

  // A new draft should never fail on a slug collision — the editor is
  // trying to start writing, not resolve a naming conflict. Suffix and
  // move on; they can rename before publishing.
  const { data: clash } = await admin
    .from("site_guides")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { data, error } = await admin
    .from("site_guides")
    .insert({
      slug,
      title,
      excerpt: str(body.excerpt, 600) ?? "",
      body_markdown: str(body.body_markdown) ?? "",
      status: "draft",
      author: str(body.author, 120) ?? "Unywebs",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await admin.from("admin_actions").insert({
    admin_user_id: user.id,
    admin_email: user.email ?? "unknown",
    action_type: "guide_created",
    notes: title,
    metadata: { slug },
  });

  return NextResponse.json({ ok: true, guide: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireContentAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { admin, user } = auth;

  const body = (await req.json().catch(() => ({}))) as Payload;
  const id = str(body.id, 64);
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const { data: current, error: readErr } = await admin
    .from("site_guides")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (readErr || !current) {
    return NextResponse.json({ error: "Guide not found." }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if ("title" in body) patch.title = str(body.title, 300) ?? "Untitled guide";
  if ("excerpt" in body) patch.excerpt = str(body.excerpt, 600) ?? "";
  if ("eyebrow" in body) patch.eyebrow = str(body.eyebrow, 120);
  if ("hero_image_url" in body) patch.hero_image_url = str(body.hero_image_url, 1000);
  if ("og_image_url" in body) patch.og_image_url = str(body.og_image_url, 1000);
  if ("body_markdown" in body)
    patch.body_markdown = typeof body.body_markdown === "string" ? body.body_markdown : "";
  if ("seo_title" in body) patch.seo_title = str(body.seo_title, 200);
  if ("seo_description" in body) patch.seo_description = str(body.seo_description, 400);
  if ("author" in body) patch.author = str(body.author, 120);

  // Slug changes.
  //
  // Before first publish the slug is free to change — nothing links to
  // it yet. After publishing it is an indexed URL, so a rename has to be
  // deliberate (confirm_slug_change) and leaves a redirect behind, or
  // every existing link to the article breaks silently.
  let redirectWritten: string | null = null;
  if ("slug" in body) {
    const nextSlug = slugify(str(body.slug, 80) ?? "");
    if (nextSlug && nextSlug !== current.slug) {
      if (current.slug_locked && body.confirm_slug_change !== true) {
        return NextResponse.json(
          {
            error: "slug_locked",
            message:
              "This guide is published, so its URL is already indexed. Renaming it will break existing links unless a redirect is created.",
            current_slug: current.slug,
            proposed_slug: nextSlug,
          },
          { status: 409 }
        );
      }

      const { data: taken } = await admin
        .from("site_guides")
        .select("id")
        .eq("slug", nextSlug)
        .neq("id", id)
        .maybeSingle();
      if (taken) {
        return NextResponse.json(
          { error: `The URL "${nextSlug}" is already used by another guide.` },
          { status: 400 }
        );
      }

      if (current.slug_locked) {
        await admin.from("site_redirects").upsert(
          { kind: "guide", from_slug: current.slug, to_slug: nextSlug },
          { onConflict: "kind,from_slug" }
        );
        // Anything that previously pointed at the old slug should now
        // point at the new one, so a chain of renames stays one hop.
        await admin
          .from("site_redirects")
          .update({ to_slug: nextSlug })
          .eq("kind", "guide")
          .eq("to_slug", current.slug);
        redirectWritten = current.slug;
      }
      patch.slug = nextSlug;
    }
  }

  // Publish / unpublish.
  if ("status" in body) {
    const s = body.status;
    if (s === "draft" || s === "published" || s === "archived") {
      patch.status = s;
      if (s === "published") {
        patch.slug_locked = true;
        if (!current.published_at) patch.published_at = new Date().toISOString();
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("site_guides")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if ("status" in patch) {
    await admin.from("admin_actions").insert({
      admin_user_id: user.id,
      admin_email: user.email ?? "unknown",
      action_type: `guide_${patch.status}`,
      notes: data.title,
      metadata: { slug: data.slug, redirect_from: redirectWritten },
    });
  }

  // An autosave keystroke should not trigger a site rebuild; a change
  // that alters what a visitor sees should. Publishing, unpublishing and
  // renaming qualify, ordinary body edits to a live article qualify too.
  const affectsLiveSite =
    "status" in patch || "slug" in patch || current.status === "published";

  let rev: Awaited<ReturnType<typeof revalidateSite>> | null = null;
  if (affectsLiveSite) {
    const paths = [...LIST_PATHS, `/guides/${data.slug}`];
    if (redirectWritten) paths.push(`/guides/${redirectWritten}`);
    rev = await revalidateSite(paths);
  }

  return NextResponse.json({
    ok: true,
    guide: data,
    revalidated: rev,
    redirect_from: redirectWritten,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireContentAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { admin, user } = auth;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("site_guides")
    .update({ status: "archived" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await admin.from("admin_actions").insert({
    admin_user_id: user.id,
    admin_email: user.email ?? "unknown",
    action_type: "guide_archived",
    notes: data.title,
    metadata: { slug: data.slug },
  });

  const rev = await revalidateSite([...LIST_PATHS, `/guides/${data.slug}`]);
  return NextResponse.json({ ok: true, revalidated: rev });
}
