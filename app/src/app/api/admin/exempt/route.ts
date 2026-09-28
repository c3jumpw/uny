import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";

// Grant or remove a billing exemption.
//
// Super admin only — deliberately narrower than the cutoff endpoint,
// which technical admins can also use on workspaces granted to them.
// Exemption is a commercial decision about who pays, not an
// operational one about who is switched on, so it stays with the
// company account rather than travelling with a client's grant.

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (getUserRole(user.email) !== "super_admin") {
    return NextResponse.json(
      { error: "Only a super admin can change billing exemptions." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.target_user_id !== "string") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const exempt = body.exempt === true;
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 300)
      : null;
  const targetUserId: string = body.target_user_id;

  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("subscription_status")
    .update({
      billing_exempt: exempt,
      exempt_reason: exempt ? reason : null,
      exempt_granted_by: exempt ? user.id : null,
      exempt_granted_at: exempt ? nowIso : null,
      updated_at: nowIso,
    })
    .eq("user_id", targetUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: targetEmail } = await supabase.rpc("email_for_user", {
    p_user: targetUserId,
  });

  await supabase.from("admin_actions").insert({
    admin_user_id: user.id,
    admin_email: user.email ?? "unknown",
    target_user_id: targetUserId,
    target_email: typeof targetEmail === "string" ? targetEmail : null,
    action_type: exempt ? "exemption_granted" : "exemption_removed",
    notes: reason,
    metadata: { exempt },
  });

  // No client email here on purpose. These are internal workspaces;
  // telling ourselves by email that we exempted ourselves is noise,
  // and the audit trail already records who did it and when.

  return NextResponse.json({ ok: true });
}
