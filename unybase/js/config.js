/* ============================================================
   UnyBase marketing site — CONFIG
   Single source of truth for pricing and app links.
   Edit values here; index.html reads from window.UNYBASE_CONFIG.
   ============================================================ */

window.UNYBASE_CONFIG = {
  /* Where "Choose Plan" / "Get Started" buttons send visitors.
   * Checkout happens after account creation on the app side —
   * these are signup links, not System.io links. */
  appUrls: {
    signupBasic: "https://unybase.unywebs.com/signup?plan=basic",
    signupPremium: "https://unybase.unywebs.com/signup?plan=premium",
    login: "https://unybase.unywebs.com/login",
  },

  /* Plan pricing shown on the pricing section.
   * Must match what the systeme.io checkout charges
   * (go-unybase.unywebs.com). The app keeps its own copy of prices,
   * "for" lines and feature lists in app/src/lib/plans.ts — change both
   * together. The feature lists below are reference copies: the pricing
   * cards in index.html are static HTML, so edit those too. */
  plans: {
    basic: {
      name: "Basic",
      for: "Best for: Single web apps and early-stage products.",
      monthly: 29.95,
      yearly: 299.95, // ~$25.00/mo equivalent
      features: [
        "Managed backend: database, auth, storage, realtime & server functions",
        "Credential vault with nightly health checks",
        "Expiry warnings for keys, domains & SSL",
        "Change requests log for your developer",
        "Standard processing and memory limits",
        "Monthly usage monitoring",
        "Community and email support",
      ],
    },
    premium: {
      name: "Premium",
      for: "Best for: AI-powered and multi-app workspaces.",
      monthly: 49.95,
      yearly: 499.95, // ~$41.66/mo equivalent
      features: [
        "Everything in Basic",
        "Higher processing speeds",
        "Larger memory limits for AI, embeddings & background jobs",
        "Proactive diagnostics on app performance",
        "Priority infrastructure support & faster response times",
        "Priority access to new UnyBase features",
      ],
    },
  },
};
