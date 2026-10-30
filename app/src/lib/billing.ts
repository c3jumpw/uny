import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification } from "@/lib/email";
import {
  addTag,
  removeTag,
  setExclusiveTag,
  SIGNUP_TAG,
  CUSTOMER_TAG,
  CANCELLED_TAG,
  PLAN_TAGS,
  CYCLE_TAGS,
} from "@/lib/systeme";
import { planById, type Cycle, type PlanId } from "@/lib/plans";

// One place that turns "we know this person paid" into account state,
// whichever way we found out (systeme.io webhook, the pull check on
// /plans, or an admin marking a trial converted).
//
//   - subscription_status -> active, failure clock cleared
//   - a running manual trial is marked converted
//   - systeme.io: add the customer tag, drop the signup tag
//   - one "payment confirmed" email, ever (renewals don't resend)

export async function markPaid(
  service: SupabaseClient,
  opts: {
    userId: string;
    email: string | null;
    plan?: PlanId | null;
    cycle?: Cycle | null;
    source: "webhook" | "pull_check" | "admin";
  }
): Promise<{ firstPayment: boolean }> {
  const now = new Date().toISOString();
  const { data: before } = await service
    .from("subscription_status")
    .select("last_payment_at, trial_ends_at, trial_converted_at, intended_plan, intended_cycle, systeme_customer_tagged_at")
    .eq("user_id", opts.userId)
    .maybeSingle();
  const prev = (before as Record<string, string | null> | null) ?? {};
  const firstPayment = !prev.last_payment_at;

  await service
    .from("subscription_status")
    .update({
      subscription_state: "active",
      last_payment_at: now,
      last_payment_failed_at: null,
      updated_at: now,
      ...(prev.trial_ends_at && !prev.trial_converted_at ? { trial_converted_at: now } : {}),
    })
    .eq("user_id", opts.userId);

  // Separate write: these columns arrive with the phase 10 migration,
  // and a missing column must not undo the activation above.
  const plan = opts.plan ?? (prev.intended_plan as PlanId | null) ?? null;
  const cycle = opts.cycle ?? (prev.intended_cycle as Cycle | null) ?? null;
  await service
    .from("subscription_status")
    .update({ active_plan: plan, active_cycle: cycle })
    .eq("user_id", opts.userId);

  if (opts.email) {
    const tagged = await addTag(opts.email, CUSTOMER_TAG, opts.userId);
    if (tagged.ok) {
      await service
        .from("subscription_status")
        .update({ systeme_customer_tagged_at: now })
        .eq("user_id", opts.userId);
      await removeTag(opts.email, SIGNUP_TAG, opts.userId);
      await removeTag(opts.email, CANCELLED_TAG, opts.userId);
    }
    // Plan / cycle segments only from confirmed payment details (the
    // webhook's price option, or a plan tag already on the contact),
    // never from what someone merely clicked on /plans.
    if (opts.plan) {
      await setExclusiveTag(opts.email, PLAN_TAGS[opts.plan], Object.values(PLAN_TAGS), opts.userId);
    }
    if (opts.cycle) {
      await setExclusiveTag(opts.email, CYCLE_TAGS[opts.cycle], Object.values(CYCLE_TAGS), opts.userId);
    }

    // Only on the first payment: a renewal, or an imported client who
    // was already paying, should not get a "welcome aboard" email.
    if (firstPayment) await sendNotification({
      to: opts.email,
      toUserId: opts.userId,
      template: "payment_confirmed",
      vars: plan ? { planName: planById(plan)?.name ?? plan } : {},
      dedupeKey: `payment_confirmed:${opts.userId}`,
      metadata: { source: opts.source },
    });
  }

  return { firstPayment };
}

// A cancelled subscription: state -> cancelled, and the contact moves
// from the customer segment to the cancelled one. Nothing is cut off
// here; the admin dashboard shows it and a human decides.
export async function markCancelled(
  service: SupabaseClient,
  opts: { userId: string; email: string | null }
): Promise<void> {
  const now = new Date().toISOString();
  await service
    .from("subscription_status")
    .update({ subscription_state: "cancelled", updated_at: now })
    .eq("user_id", opts.userId);
  if (opts.email) {
    const r = await addTag(opts.email, CANCELLED_TAG, opts.userId);
    if (r.ok) await removeTag(opts.email, CUSTOMER_TAG, opts.userId);
  }
}
