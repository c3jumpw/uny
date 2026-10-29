import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/admin";
import { serviceClient, hasServiceRole } from "@/lib/supabase/service";
import { addTag, contactPaidTag, systemeConfigured, SIGNUP_TAG, CUSTOMER_TAG } from "@/lib/systeme";
import { markPaid } from "@/lib/billing";

export const maxDuration = 300;

// Super admin: bring systeme.io segments in line with the app.
//   - paying accounts without the customer tag -> tag them
//   - unpaid accounts without the signup tag   -> tag them
//   - unpaid accounts whose contact already carries a paid tag
//     -> activate (payment we missed because no webhook arrived)
// Billing-exempt (internal) accounts are left out of the segments.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (getUserRole(user.email) !== "super_admin") {
    return NextResponse.json({ error: "Super admin only." }, { status: 403 });
  }
  if (!systemeConfigured()) return NextResponse.json({ error: "SYSTEME_API_KEY is not set." }, { status: 400 });
  if (!hasServiceRole()) return NextResponse.json({ error: "Service role not configured." }, { status: 500 });

  const service = serviceClient();
  const { data } = await service.from("subscription_status").select("*").eq("billing_exempt", false);
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const out = { tagged_signup: 0, tagged_customer: 0, activated: 0, failed: 0 };
  const now = new Date().toISOString();

  for (const r of rows) {
    const userId = r.user_id as string;
    const { data: email } = await service.rpc("email_for_user", { p_user: userId });
    if (typeof email !== "string") continue;
    const paying = r.subscription_state === "active" || Boolean(r.last_payment_at);

    if (paying) {
      if (!r.systeme_customer_tagged_at) {
        const t = await addTag(email, CUSTOMER_TAG, userId);
        if (t.ok) {
          out.tagged_customer += 1;
          await service.from("subscription_status").update({ systeme_customer_tagged_at: now }).eq("user_id", userId);
        } else out.failed += 1;
      }
      continue;
    }

    const pull = await contactPaidTag(email, userId);
    if (pull.paid) {
      await markPaid(service, { userId, email, source: "pull_check" });
      out.activated += 1;
      continue;
    }
    if (!r.systeme_signup_tagged_at) {
      const t = await addTag(email, SIGNUP_TAG, userId);
      if (t.ok) {
        out.tagged_signup += 1;
        await service.from("subscription_status").update({ systeme_signup_tagged_at: now }).eq("user_id", userId);
      } else out.failed += 1;
    }
  }

  await supabase.from("admin_actions").insert({
    admin_user_id: user.id,
    admin_email: user.email ?? "unknown",
    action_type: "systeme_sync",
    notes: `signup ${out.tagged_signup}, customer ${out.tagged_customer}, activated ${out.activated}, failed ${out.failed}`,
    metadata: out,
  });

  return NextResponse.json(out);
}
