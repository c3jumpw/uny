import { NextRequest, NextResponse } from "next/server";
import {
  logEvent,
  requireSiteAdmin,
  revalidateSite,
} from "@/lib/admin";
import { slugify } from "@/lib/shared";

// Solutions CRUD for admin.unywebs.com/website/solutions.
//
// POST   create
// PATCH  update one, or reorder many
// DELETE archive (never a hard delete; see below)

const LIST_PATHS = ["/", "/solutions"];

// A solution also owns its own detail page, so edits have to refresh
// that too, not just the listings it appears on.
function pathsFor(slug?: string | null) {
  return slug ? [...LIST_PATHS, `/solutions/${slug}`] : [...LIST_PATHS];
}

type Payload = Record<string, unknown>;

function str(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export async function POST(req: NextRequest) {
  const auth = await requireSiteAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const admin = auth.supabase;

  const body = (await req.json().catch(() => ({}))) as Payload;
  const name = str(body.name, 200);
  if (!name) {
    return NextResponse.json({ error: "A name is required." }, { status: 400 });
  }

  const slug = str(body.slug, 80) ?? slugify(name);

  // New tools go to the end of the list rather than the top: position is
  // an editorial decision, and dropping an unreviewed row into the first
  // slot on a live page is not one the system should make.
  const { data: last } = await admin
    .from("site_solutions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder =
    ((last as { sort_order: number } | null)?.sort_order ?? 0) + 10;

  const { data, error } = await admin
    .from("site_solutions")
    .insert({
      slug,
      name,
      blurb: str(body.blurb) ?? "",
      cta_label: str(body.cta_label, 80) ?? "Start Today",
      cta_url: str(body.cta_url, 1000),
      logo_url: str(body.logo_url, 1000),
      category: str(body.category, 80),
      tagline: str(body.tagline, 200),
      overview: str(body.overview, 2000),
      best_for: str(body.best_for, 500),
      pricing_note: str(body.pricing_note, 300),
      domain: str(body.domain, 200),
      brand_color: str(body.brand_color, 20),
      features: Array.isArray(body.features) ? body.features : [],
      status: body.status === "published" ? "published" : "draft",
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    const msg =
      error.code === "23505"
        ? `The slug "${slug}" is already in use by another tool.`
        : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await logEvent(auth, {
    action: "solution_created",
    target_kind: "solution",
    target_slug: slug,
    notes: name,
    metadata: { slug, status: data.status },
  });

  const rev = await revalidateSite(pathsFor(data.slug));
  return NextResponse.json({ ok: true, solution: data, revalidated: rev });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSiteAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const admin = auth.supabase;

  const body = (await req.json().catch(() => ({}))) as Payload;

  // Reorder: a single call carrying the whole new order, so a drag that
  // moves one card can't leave the list half-renumbered.
  if (Array.isArray(body.order)) {
    const order = body.order as { id: string; sort_order: number }[];
    for (const row of order) {
      if (typeof row?.id !== "string") continue;
      await admin
        .from("site_solutions")
        .update({ sort_order: Number(row.sort_order) || 0 })
        .eq("id", row.id);
    }
    const rev = await revalidateSite(LIST_PATHS);
    return NextResponse.json({ ok: true, revalidated: rev });
  }

  const id = str(body.id, 64);
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("name" in body) patch.name = str(body.name, 200) ?? "";
  if ("slug" in body) patch.slug = str(body.slug, 80);
  if ("blurb" in body) patch.blurb = str(body.blurb) ?? "";
  if ("cta_label" in body) patch.cta_label = str(body.cta_label, 80) ?? "Start Today";
  if ("cta_url" in body) patch.cta_url = str(body.cta_url, 1000);
  if ("logo_url" in body) patch.logo_url = str(body.logo_url, 1000);
  if ("category" in body) patch.category = str(body.category, 80);
  if ("featured" in body) patch.featured = body.featured === true;
  if ("tagline" in body) patch.tagline = str(body.tagline, 200);
  if ("overview" in body) patch.overview = str(body.overview, 2000);
  if ("best_for" in body) patch.best_for = str(body.best_for, 500);
  if ("pricing_note" in body) patch.pricing_note = str(body.pricing_note, 300);
  if ("domain" in body) patch.domain = str(body.domain, 200);
  if ("brand_color" in body) patch.brand_color = str(body.brand_color, 20);
  if ("features" in body) {
    // Drop blank rows so an editor who clears a feature removes it
    // rather than leaving an empty block on the live page.
    patch.features = Array.isArray(body.features)
      ? (body.features as { title?: unknown; body?: unknown }[])
          .map((f) => ({
            title: typeof f?.title === "string" ? f.title.trim().slice(0, 80) : "",
            body: typeof f?.body === "string" ? f.body.trim().slice(0, 400) : "",
          }))
          .filter((f) => f.title || f.body)
      : [];
  }
  if ("status" in body) {
    const s = body.status;
    if (s === "draft" || s === "published" || s === "archived") patch.status = s;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // Note the slug before the change, so a renamed tool's old address can
  // keep working (OpenPhone becoming Quo, say).
  let previousSlug: string | null = null;
  if ("slug" in patch) {
    const { data: before } = await admin
      .from("site_solutions")
      .select("slug")
      .eq("id", id)
      .single();
    previousSlug = before?.slug ?? null;
  }

  const { data, error } = await admin
    .from("site_solutions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    const msg =
      error.code === "23505"
        ? "That slug is already in use by another tool."
        : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const renamedFrom =
    previousSlug && data.slug && previousSlug !== data.slug ? previousSlug : null;
  if (renamedFrom) {
    await admin.from("site_redirects").upsert(
      { kind: "solution", from_slug: renamedFrom, to_slug: data.slug },
      { onConflict: "kind,from_slug" }
    );
    // Keep chains of renames to one hop, and drop any redirect away from
    // the slug now in use so the live page can't forward to itself.
    await admin
      .from("site_redirects")
      .update({ to_slug: data.slug })
      .eq("kind", "solution")
      .eq("to_slug", renamedFrom);
    await admin
      .from("site_redirects")
      .delete()
      .eq("kind", "solution")
      .eq("from_slug", data.slug);
    await logEvent(auth, {
      action: "solution_renamed",
      target_kind: "solution",
      target_slug: data.slug,
      notes: data.name,
      metadata: { from: renamedFrom, to: data.slug },
    });
  }

  if ("status" in patch) {
    await logEvent(auth, {
    action: `solution_${patch.status}`,
    target_kind: "solution",
    target_slug: data.slug,
    notes: data.name,
    metadata: { slug: data.slug },
  });
  }

  const paths = pathsFor(data.slug);
  if (renamedFrom) paths.push(`/solutions/${renamedFrom}`);
  const rev = await revalidateSite(paths);
  return NextResponse.json({ ok: true, solution: data, revalidated: rev });
}

// Archive rather than delete. An affiliate program that pauses today
// often resumes later, and the referral URL is the thing that is
// tedious to reconstruct. Archived rows leave the site immediately but
// keep their link.
export async function DELETE(req: NextRequest) {
  const auth = await requireSiteAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const admin = auth.supabase;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("site_solutions")
    .update({ status: "archived" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logEvent(auth, {
    action: "solution_archived",
    target_kind: "solution",
    target_slug: data.slug,
    notes: data.name,
    metadata: { slug: data.slug },
  });

  const rev = await revalidateSite(pathsFor(data.slug));
  return NextResponse.json({ ok: true, revalidated: rev });
}
