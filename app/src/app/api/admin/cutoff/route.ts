import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, canAccessAdmin } from "@/lib/admin";

// Cutoff / restore endpoint.
//
// Body: { target_user_id: string, action: "cutoff" | "restore", reason?: string }
//
// Cutoff flips automations_active=false, revokes the API key, logs
// the action to admin_actions, and (later) sends the client a
// courtesy email explaining they've been paused.
//
// Restore reverses the state: automations_active=true, un-revokes
// the key, logs the action. We do NOT re-issue a new key — the
// same one gets un-revoked so client integrations keep working
// once the payment situation is resolved.

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const role = getUserRole(user.email);
  if (!canAccessAdmin(role))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.target_user_id !== "string" || typeof body.action !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const targetUserId: string = body.target_user_id;
  const action: string = body.action;
  const reason: string | null =
    typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

  if (action !== "cutoff" && action !== "restore") {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  // Look up target email for the audit trail. RLS lets a super
  // admin read any status row; for a technical admin, RLS returns
  // only granted rows, so an unauthorized cutoff attempt will 404.
  const { data: statusRow, error: statusErr } = await supabase
    .from("subscription_status")
    .select("user_id")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (statusErr || !statusRow) {
    return NextResponse.json({ error: "target_not_found_or_forbidden" }, { status: 404 });
  }
  const { data: targetInfo } = await supabase
    .rpc("email_for_user", { p_user: targetUserId });
  const targetEmail = typeof targetInfo === "string" ? targetInfo : null;

  const nowIso = new Date().toISOString();

  if (action === "cutoff") {
    const { error: statusUpdateErr } = await supabase
      .from("subscription_status")
      .update({
        automations_active: false,
        cut_off_at: nowIso,
        cut_off_by: user.id,
        cut_off_reason: reason,
        updated_at: nowIso,
      })
      .eq("user_id", targetUserId);
    if (statusUpdateErr) {
      return NextResponse.json({ error: statusUpdateErr.message }, { status: 500 });
    }

    await supabase
      .from("api_keys")
      .update({ revoked_at: nowIso, revoked_by: user.id })
      .eq("user_id", targetUserId);
  } else {
    // restore
    const { error: statusUpdateErr } = await supabase
      .from("subscription_status")
      .update({
        automations_active: true,
        cut_off_at: null,
        cut_off_by: null,
        cut_off_reason: null,
        updated_at: nowIso,
      })
      .eq("user_id", targetUserId);
    if (statusUpdateErr) {
      return NextResponse.json({ error: statusUpdateErr.message }, { status: 500 });
    }

    await supabase
      .from("api_keys")
      .update({ revoked_at: null, revoked_by: null })
      .eq("user_id", targetUserId);
  }

  await supabase.from("admin_actions").insert({
    admin_user_id: user.id,
    admin_email: user.email ?? "unknown",
    target_user_id: targetUserId,
    target_email: targetEmail,
    action_type: action,
    notes: reason,
    metadata: { role },
  });

  // Client email notification: phase 4+ when SMTP is configured.
  // Log for now so we can see the outbound queue building up.
  if (action === "cutoff" && targetEmail) {
    console.log(
      `[admin_action] would email ${targetEmail}: automations paused by ${user.email}${
        reason ? ` (reason: ${reason})` : ""
      }`
    );
  }

  return NextResponse.json({ ok: true });
}
