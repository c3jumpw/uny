// Single source of truth for plans, prices and checkout links.
//
// Checkout links are fixed constants (or env-configured), never taken
// from client input, so sending a user to checkout can never become an
// open redirect: the client only chooses which known link to use.
//
// go-unybase.unywebs.com is a redirect layer in front of the systeme.io
// checkout, so the checkout provider can change without touching code.
//
// Yearly links: set NEXT_PUBLIC_CHECKOUT_BASIC_YEARLY and
// NEXT_PUBLIC_CHECKOUT_PREMIUM_YEARLY once the yearly order forms
// exist. Until then the yearly option uses the plan's main checkout
// page, and the plans page says to pick annual billing there.

export type PlanId = "basic" | "premium";
export type Cycle = "monthly" | "yearly";

export type Plan = {
  id: PlanId;
  name: string;
  monthly: number;
  yearly: number;
  tagline: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    monthly: 29.95,
    yearly: 299.5,
    tagline: "Single web apps and early-stage products.",
    features: [
      "Credential vault with live health checks",
      "Expiry warnings at 14, 7 and 1 days",
      "Domain and SSL renewal tracking",
      "Change requests log",
      "Standard processing and memory limits",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    monthly: 49.95,
    yearly: 499.5,
    tagline: "AI-powered and integrated workspaces.",
    features: [
      "Everything in Basic",
      "Higher processing speeds",
      "Larger memory limits",
      "Headroom for embeddings, background jobs and multi-service pipelines",
      "Best suited for AI-integrated workspaces",
    ],
  },
];

const MONTHLY: Record<PlanId, string> = {
  basic: "https://go-unybase.unywebs.com/d9fae112",
  premium: "https://go-unybase.unywebs.com/d9fae112-d0f105db",
};

const YEARLY: Record<PlanId, string | undefined> = {
  basic: process.env.NEXT_PUBLIC_CHECKOUT_BASIC_YEARLY || undefined,
  premium: process.env.NEXT_PUBLIC_CHECKOUT_PREMIUM_YEARLY || undefined,
};

export function isPlanId(v: unknown): v is PlanId {
  return v === "basic" || v === "premium";
}
export function isCycle(v: unknown): v is Cycle {
  return v === "monthly" || v === "yearly";
}

export function planById(id: string | null | undefined): Plan | null {
  return PLANS.find((p) => p.id === id) ?? null;
}

/** True when a dedicated yearly checkout link is configured. */
export function hasDedicatedYearly(plan: PlanId): boolean {
  return Boolean(YEARLY[plan]);
}

export function checkoutUrl(plan: PlanId, cycle: Cycle, email?: string | null): string {
  const base = (cycle === "yearly" && YEARLY[plan]) || MONTHLY[plan];
  if (!email) return base;
  // Pre-fills the checkout where the page supports it; ignored where
  // it does not. Payment is matched back to the account by email, so
  // nudging the same address into the form matters.
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}email=${encodeURIComponent(email)}`;
}

export function formatPrice(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function yearlySaving(p: Plan): number {
  return Math.round((p.monthly * 12 - p.yearly) * 100) / 100;
}

/** Best-effort plan + cycle from a systeme.io price-plan name. */
export function inferPlanFromText(text: string | null | undefined): {
  plan: PlanId | null;
  cycle: Cycle | null;
} {
  const t = (text || "").toLowerCase();
  const plan: PlanId | null = t.includes("premium")
    ? "premium"
    : t.includes("basic")
      ? "basic"
      : null;
  const cycle: Cycle | null = /year|annual|annuel|\byr\b/.test(t)
    ? "yearly"
    : /month|mensuel|\bmo\b/.test(t)
      ? "monthly"
      : null;
  return { plan, cycle };
}
