// Server-side map from plan -> checkout URL. Kept as a fixed constant
// (not derived from client input) so redirecting a freshly-created
// account into checkout can never become an open redirect — the client
// can only select which of these two known URLs to use, never supply
// an arbitrary target.
//
// The go-unybase.unywebs.com domain is a redirect layer in front of the
// underlying systeme.io checkout so we can change the checkout provider
// without touching this code.

export const CHECKOUT_URLS: Record<string, string> = {
  basic: "https://go-unybase.unywebs.com/d9fae112",
  premium: "https://go-unybase.unywebs.com/d9fae112-d0f105db",
};

export function checkoutUrlForPlan(plan?: string | null): string | null {
  if (!plan) return null;
  return CHECKOUT_URLS[plan] ?? null;
}
