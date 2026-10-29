import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, hasServiceRole } from "@/lib/supabase/service";
import { getAccess } from "@/lib/access";
import { contactPaidTag, systemeConfigured } from "@/lib/systeme";
import { markPaid } from "@/lib/billing";
import {
  PLANS,
  checkoutUrl,
  hasDedicatedYearly,
  isCycle,
  isPlanId,
  type Cycle,
  type PlanId,
} from "@/lib/plans";
import { PlansClient } from "@/components/PlansClient";

// The paywall. Anyone who has never paid (or whose trial ended) lands
// here after logging in, picks monthly or yearly, and goes to checkout.
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string }>;
}) {
  const { plan: qPlan, cycle: qCycle } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/plans");

  const access = await getAccess(supabase, user);
  // Admins can preview the page; people on a trial can pay early.
  if (access.allowed && access.reason !== "admin" && access.reason !== "trial") redirect("/dashboard");

  // Payment may have landed without a webhook. Ask systeme.io once on
  // the way in so a paying customer never sits on this page.
  if ((!access.allowed || access.reason === "trial") && user.email && systemeConfigured() && hasServiceRole()) {
    const r = await contactPaidTag(user.email, user.id);
    if (r.paid) {
      await markPaid(serviceClient(), { userId: user.id, email: user.email, source: "pull_check" });
      redirect("/dashboard?welcome=1");
    }
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const status = access.status;
  const defaultPlan: PlanId =
    (isPlanId(qPlan) && qPlan) ||
    (isPlanId(status?.intended_plan) && (status!.intended_plan as PlanId)) ||
    (isPlanId(meta.intended_plan) && (meta.intended_plan as PlanId)) ||
    "basic";
  const defaultCycle: Cycle =
    (isCycle(qCycle) && qCycle) ||
    (isCycle(status?.intended_cycle) && (status!.intended_cycle as Cycle)) ||
    (isCycle(meta.intended_cycle) && (meta.intended_cycle as Cycle)) ||
    "monthly";

  const links: Record<PlanId, Record<Cycle, string>> = {
    basic: {
      monthly: checkoutUrl("basic", "monthly", user.email),
      yearly: checkoutUrl("basic", "yearly", user.email),
    },
    premium: {
      monthly: checkoutUrl("premium", "monthly", user.email),
      yearly: checkoutUrl("premium", "yearly", user.email),
    },
  };

  return (
    <PlansClient
      email={user.email ?? ""}
      plans={PLANS}
      links={links}
      dedicatedYearly={{ basic: hasDedicatedYearly("basic"), premium: hasDedicatedYearly("premium") }}
      defaultPlan={defaultPlan}
      defaultCycle={defaultCycle}
      reason={access.reason}
      trialEndedOn={
        access.reason === "trial_ended" || access.reason === "trial" ? (status?.trial_ends_at ?? null) : null
      }
    />
  );
}
