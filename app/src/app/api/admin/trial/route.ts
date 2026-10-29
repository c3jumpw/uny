import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";
import { sendNotification } from "@/lib/email";
import { serviceClient, hasServiceRole } from "@/lib/supabase/service";
import { markPaid } from "@/lib/billing";

// Manual trials for prospects who signed up but didn't check out.
//
// Super admin only: like exemptions, a trial is a commercial decision
// about who pays, not an operational one.
//
//   grant    set an end date (exact date or N days). Re-granting on a
//            running trial extends it and keeps the original start.
//   convert  they paid outside the normal flow: mark converted + active
//   end      end the trial now. They see the plan picker next login;
//            nothing is deleted and no automations are touched.

function endOfDayUtc(dateOnly: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const d = new Date(`${dateOnly}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function prettyDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (getUserRole(user.email) !== "super_admin") {
    return NextResponse.json({ error: "Only a super admin can manage trials." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action as "grant" | "convert" | "end" | undefined;
  const targetUserId = typeof body?.target_user_id === "string" ? body.target_user_id : null;
  if (!targetUserId || !action || !["grant", "convert", "end"].includes(action)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;
  const notify = body.notify !== false;

  const { data: existing } = await supabase
    .from("subscription_status")
    .select("trial_started_at, trial_ends_at, trial_converted_at")
    .eq("user_id", targetUserId)
    .maybeSingle();
  const prev = (existing as Record<string, string | null> | null) ?? {};

  const { data: targetEmail } = await supabase.rpc("email_for_user", { p_user: targetUserId });
  const email = typeof targetEmail === "string" ? targetEmail : null;

  const nowIso = new Date().toISOString();
  let actionType = "";
  let endsAt: string | null = null;

  if (action === "grant") {
    if (typeof body.ends_at === "string") endsAt = endOfDayUtc(body.ends_at);
    else if (Number.isFinite(body.days) && body.days > 0 && body.days <= 366) {
      endsAt = new Date(Date.now() + Number(body.days) * 86_400_000).toISOString();
    }
    if (!endsAt || new Date(endsAt).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Pick an end date in the future." }, { status: 400 });
    }
    const running = Boolean(prev.trial_ends_at && !prev.trial_converted_at);
    actionType = running ? "trial_extended" : "trial_granted";
    const { error } = await supabase
      .from("subscription_status")
      .update({
        trial_started_at: running && prev.trial_started_at ? prev.trial_started_at : nowIso,
        trial_ends_at: endsAt,
        trial_granted_by: user.id,
        trial_note: note,
        trial_converted_at: null,
        updated_at: nowIso,
      })
      .eq("user_id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (action === "convert") {
    actionType = "trial_converted";
    if (hasServiceRole()) {
      await markPaid(serviceClient(), { userId: targetUserId, email, source: "admin" });
    } else {
      const { error } = await supabase
        .from("subscription_status")
        .update({
          trial_converted_at: nowIso,
          subscription_state: "active",
          last_payment_at: nowIso,
          last_payment_failed_at: null,
          updated_at: nowIso,
        })
        .eq("user_id", targetUserId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    actionType = "trial_ended";
    const { error } = await supabase
      .from("subscription_status")
      .update({ trial_ends_at: nowIso, updated_at: nowIso })
      .eq("user_id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("admin_actions").insert({
    admin_user_id: user.id,
    admin_email: user.email ?? "unknown",
    target_user_id: targetUserId,
    target_email: email,
    action_type: actionType,
    notes: note,
    metadata: { action, ends_at: endsAt, notify },
  });

  if (action === "grant" && notify && email && endsAt) {
    await sendNotification({
      to: email,
      toUserId: targetUserId,
      template: "trial_granted",
      vars: { endsOn: prettyDate(endsAt), ...(note && body.share_note ? { note } : {}) },
      dedupeKey: `trial_granted:${targetUserId}:${endsAt.slice(0, 10)}`,
    });
  }

  return NextResponse.json({ ok: true, ends_at: endsAt });
}
