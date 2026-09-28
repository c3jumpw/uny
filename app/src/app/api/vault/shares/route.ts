import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendNotification } from "@/lib/email";

// Scoped vault shares.
//
// Unlike technical-admin grants, which hand over a whole workspace,
// a share names exactly what the grantee can see: everything, one
// tagged system, or a single credential.
//
// Shares are keyed by email rather than user id so they can be
// issued to someone who has not signed up yet. RLS matches the JWT
// email claim, so the share simply starts working when that person
// creates an account.

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
      { error: "You already have access to your own credentials." },
      { status: 400 }
    );
  }

  const scopeType: string = body.scope_type;
  if (!["all", "system", "integration"].includes(scopeType)) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }
  const scopeValue: string | null =
    scopeType === "all"
      ? null
      : typeof body.scope_value === "string" && body.scope_value.trim()
        ? body.scope_value.trim()
        : null;
  if (scopeType !== "all" && !scopeValue) {
    return NextResponse.json({ error: "scope_value_required" }, { status: 400 });
  }

  let expiresAt: string | null = null;
  if (typeof body.expires_in_days === "number" && body.expires_in_days > 0) {
    expiresAt = new Date(Date.now() + body.expires_in_days * 86_400_000).toISOString();
  }

  // Re-sharing the same scope to the same person should refresh the
  // existing share rather than collide with the unique index.
  const { data: existing } = await supabase
    .from("vault_shares")
    .select("id")
    .eq("workspace_owner_id", user.id)
    .ilike("grantee_email", email)
    .eq("scope_type", scopeType)
    .is("revoked_at", null)
    .maybeSingle();

  const payload = {
    workspace_owner_id: user.id,
    grantee_email: email,
    scope_type: scopeType,
    scope_value: scopeValue,
    note: typeof body.note === "string" ? body.note.trim().slice(0, 300) : null,
    granted_by: user.id,
    granted_at: new Date().toISOString(),
    expires_at: expiresAt,
    revoked_at: null,
    revoked_by: null,
  };

  const existingId = (existing as { id: string } | null)?.id;
  const { error } = existingId
    ? await supabase.from("vault_shares").update(payload).eq("id", existingId)
    : await supabase.from("vault_shares").insert(payload);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const scopeLabel =
    scopeType === "all"
      ? "all credentials in the workspace"
      : scopeType === "system"
        ? `credentials tagged "${scopeValue}"`
        : "one specific credential";

  await sendNotification({
    to: email,
    template: "vault_shared",
    vars: {
      ownerEmail: user.email ?? "A UnyBase workspace",
      scopeLabel,
      ...(expiresAt
        ? { expiresPhrase: `This access expires on ${new Date(expiresAt).toLocaleDateString()}.` }
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

  const { error } = await supabase
    .from("vault_shares")
    .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
    .eq("id", id)
    .eq("workspace_owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
