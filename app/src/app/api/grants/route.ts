import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendNotification } from "@/lib/email";

// Technical admin access grants, issued by the client.
//
// This is the piece that turns the technical-admin role from a
// claim into a permission. A technical admin can hold the role and
// still see nothing: visibility only exists where a client has
// explicitly granted it, and RLS enforces that on every query.
//
// Grants are revocable and optionally time-boxed. has_tech_admin_grant()
// checks expires_at, so a 30-day grant genuinely stops working on
// day 31 rather than quietly becoming permanent.

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  if (email === user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "You already have full access to your own workspace." },
      { status: 400 }
    );
  }

  // Only accounts that actually hold an admin role can be granted.
  // Without this, a client could "grant access" to a friend's plain
  // client account and reasonably expect it to work — it wouldn't,
  // since the admin dashboard is role-gated, so failing loudly here
  // is kinder than issuing a grant that does nothing.
  const { data: match } = await supabase.rpc("find_technical_admin_by_email", {
    p_email: email,
  });
  const found = Array.isArray(match) ? match[0] : match;
  if (!found?.user_id) {
    return NextResponse.json(
      {
        error:
          "No technical admin found with that email. Check the address, or ask them to confirm their account is set up.",
      },
      { status: 404 }
    );
  }

  let expiresAt: string | null = null;
  if (typeof body.expires_in_days === "number" && body.expires_in_days > 0) {
    expiresAt = new Date(
      Date.now() + body.expires_in_days * 86_400_000
    ).toISOString();
  }

  // Re-granting a previously revoked admin should reactivate the
  // existing row rather than fail on the unique constraint.
  const { error } = await supabase
    .from("technical_admin_grants")
    .upsert(
      {
        workspace_owner_id: user.id,
        technical_admin_id: found.user_id,
        granted_by: user.id,
        granted_at: new Date().toISOString(),
        revoked_at: null,
        revoked_by: null,
        expires_at: expiresAt,
        note: typeof body.note === "string" ? body.note.trim().slice(0, 300) : null,
      },
      { onConflict: "workspace_owner_id,technical_admin_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendNotification({
    to: email,
    toUserId: found.user_id,
    template: "grant_granted",
    vars: {
      ownerEmail: user.email ?? "A client",
      ...(expiresAt
        ? {
            expiresPhrase: `expires on ${new Date(expiresAt).toLocaleDateString()}`,
          }
        : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: grant } = await supabase
    .from("technical_admin_grants")
    .select("technical_admin_id")
    .eq("id", id)
    .eq("workspace_owner_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("technical_admin_grants")
    .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
    .eq("id", id)
    .eq("workspace_owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const adminId = (grant as { technical_admin_id: string } | null)?.technical_admin_id;
  if (adminId) {
    const { data: adminEmail } = await supabase.rpc("email_for_user", {
      p_user: adminId,
    });
    if (typeof adminEmail === "string") {
      await sendNotification({
        to: adminEmail,
        toUserId: adminId,
        template: "grant_revoked",
        vars: { ownerEmail: user.email ?? "A client" },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
