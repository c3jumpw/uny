// Integration hub: provider definitions and health-check logic.
//
// Each provider knows how to verify its own credential by hitting
// a cheap, read-only endpoint on the real API. A green status
// means the credential worked *just now*, which is a far stronger
// signal than "we stored it and nobody has complained yet".
//
// Health checks run on demand (button in the UI) rather than on a
// cron, because phase 3 has no scheduler yet. The expiry-date
// tracking below is the secondary signal that covers the gap:
// a credential can be valid today and still be two days from
// expiring, and that is exactly the failure we are trying to
// prevent.

export type IntegrationType =
  | "github_pat"
  | "supabase"
  | "systeme_io"
  | "clickup"
  | "vercel"
  | "generic_http";

export type AccountOwnership = "agency_master" | "client_own";

export type HealthStatus = "healthy" | "degraded" | "failed" | "unknown";

export type Integration = {
  id: string;
  workspace_owner_id: string;
  name: string;
  integration_type: IntegrationType;
  credential_ciphertext: string | null;
  credential_iv: string | null;
  credential_tag: string | null;
  credential_hint: string | null;
  env_var_name: string | null;
  callback_url: string | null;
  base_url: string | null;
  expires_at: string | null;
  last_regenerated_at: string | null;
  account_identifier: string | null;
  account_ownership: AccountOwnership;
  last_health_check_at: string | null;
  health_status: HealthStatus;
  health_detail: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const PROVIDERS: Record<
  IntegrationType,
  {
    label: string;
    credentialLabel: string;
    needsBaseUrl: boolean;
    baseUrlLabel?: string;
    hasExpiry: boolean;
    hint: string;
  }
> = {
  github_pat: {
    label: "GitHub",
    credentialLabel: "Personal access token",
    needsBaseUrl: false,
    hasExpiry: true,
    hint: "Fine-grained or classic PAT. Checked against GET /user.",
  },
  supabase: {
    label: "Supabase",
    credentialLabel: "Anon or service role key",
    needsBaseUrl: true,
    baseUrlLabel: "Project URL",
    hasExpiry: false,
    hint: "Checked against /auth/v1/settings on your project URL.",
  },
  systeme_io: {
    label: "systeme.io",
    credentialLabel: "API key",
    needsBaseUrl: false,
    hasExpiry: false,
    hint: "Checked against the systeme.io contacts endpoint.",
  },
  clickup: {
    label: "ClickUp",
    credentialLabel: "API token",
    needsBaseUrl: false,
    hasExpiry: false,
    hint: "Checked against GET /api/v2/user.",
  },
  vercel: {
    label: "Vercel",
    credentialLabel: "Access token",
    needsBaseUrl: false,
    hasExpiry: true,
    hint: "Checked against GET /v2/user.",
  },
  generic_http: {
    label: "Generic HTTP",
    credentialLabel: "Token or secret (optional)",
    needsBaseUrl: true,
    baseUrlLabel: "Health check URL",
    hasExpiry: true,
    hint: "We GET the URL and treat any 2xx as healthy.",
  },
};

// Run a live check against the provider. Returns status + detail.
// Never throws — a failed check is data, not an exception.
export async function runHealthCheck(
  type: IntegrationType,
  credential: string | null,
  baseUrl: string | null
): Promise<{ status: HealthStatus; detail: string }> {
  const timeout = AbortSignal.timeout(10_000);

  try {
    switch (type) {
      case "github_pat": {
        if (!credential) return { status: "unknown", detail: "No credential stored." };
        const res = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${credential}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "UnyBase-HealthCheck",
          },
          signal: timeout,
        });
        if (res.ok) {
          const body = (await res.json()) as { login?: string };
          const scopes = res.headers.get("x-oauth-scopes");
          return {
            status: "healthy",
            detail: `Authenticated as ${body.login ?? "unknown"}${
              scopes ? ` (scopes: ${scopes})` : ""
            }.`,
          };
        }
        if (res.status === 401)
          return { status: "failed", detail: "Token rejected (401). Likely expired or revoked." };
        return { status: "degraded", detail: `GitHub returned ${res.status}.` };
      }

      case "supabase": {
        if (!credential) return { status: "unknown", detail: "No credential stored." };
        if (!baseUrl) return { status: "unknown", detail: "No project URL set." };
        const url = `${baseUrl.replace(/\/$/, "")}/auth/v1/settings`;
        const res = await fetch(url, {
          headers: { apikey: credential, Authorization: `Bearer ${credential}` },
          signal: timeout,
        });
        if (res.ok) return { status: "healthy", detail: "Project reachable, key accepted." };
        if (res.status === 401)
          return { status: "failed", detail: "Key rejected (401)." };
        return { status: "degraded", detail: `Supabase returned ${res.status}.` };
      }

      case "systeme_io": {
        if (!credential) return { status: "unknown", detail: "No credential stored." };
        const res = await fetch("https://api.systeme.io/api/contacts?limit=1", {
          headers: { "X-API-Key": credential, Accept: "application/json" },
          signal: timeout,
        });
        if (res.ok) return { status: "healthy", detail: "API key accepted." };
        if (res.status === 401 || res.status === 403)
          return { status: "failed", detail: `Key rejected (${res.status}).` };
        return { status: "degraded", detail: `systeme.io returned ${res.status}.` };
      }

      case "clickup": {
        if (!credential) return { status: "unknown", detail: "No credential stored." };
        const res = await fetch("https://api.clickup.com/api/v2/user", {
          headers: { Authorization: credential },
          signal: timeout,
        });
        if (res.ok) {
          const body = (await res.json()) as { user?: { username?: string } };
          return {
            status: "healthy",
            detail: `Authenticated as ${body.user?.username ?? "unknown"}.`,
          };
        }
        if (res.status === 401)
          return { status: "failed", detail: "Token rejected (401)." };
        return { status: "degraded", detail: `ClickUp returned ${res.status}.` };
      }

      case "vercel": {
        if (!credential) return { status: "unknown", detail: "No credential stored." };
        const res = await fetch("https://api.vercel.com/v2/user", {
          headers: { Authorization: `Bearer ${credential}` },
          signal: timeout,
        });
        if (res.ok) {
          const body = (await res.json()) as { user?: { username?: string } };
          return {
            status: "healthy",
            detail: `Authenticated as ${body.user?.username ?? "unknown"}.`,
          };
        }
        if (res.status === 401 || res.status === 403)
          return { status: "failed", detail: `Token rejected (${res.status}).` };
        return { status: "degraded", detail: `Vercel returned ${res.status}.` };
      }

      case "generic_http": {
        if (!baseUrl) return { status: "unknown", detail: "No health check URL set." };
        const headers: Record<string, string> = {};
        if (credential) headers.Authorization = `Bearer ${credential}`;
        const res = await fetch(baseUrl, { headers, signal: timeout });
        if (res.ok) return { status: "healthy", detail: `Returned ${res.status}.` };
        return { status: "degraded", detail: `Returned ${res.status}.` };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("timed out") || msg.includes("abort"))
      return { status: "failed", detail: "Request timed out after 10s." };
    return { status: "failed", detail: `Could not reach provider: ${msg}` };
  }
}

// Expiry status is the secondary signal: a credential can pass a
// health check today and still expire on Friday.
export type ExpiryState = {
  label: string;
  color: string;
  urgent: boolean;
  daysLeft: number | null;
};

export function expiryState(expiresAt: string | null): ExpiryState {
  if (!expiresAt)
    return { label: "No expiry set", color: "var(--muted)", urgent: false, daysLeft: null };
  const days = Math.floor(
    (new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  if (days < 0)
    return { label: `Expired ${Math.abs(days)}d ago`, color: "#ffb3b3", urgent: true, daysLeft: days };
  if (days <= 1)
    return { label: days === 0 ? "Expires today" : "Expires tomorrow", color: "#ffb3b3", urgent: true, daysLeft: days };
  if (days <= 7)
    return { label: `Expires in ${days}d`, color: "#ff8080", urgent: true, daysLeft: days };
  if (days <= 14)
    return { label: `Expires in ${days}d`, color: "#ffb066", urgent: false, daysLeft: days };
  return { label: `Expires in ${days}d`, color: "var(--paper-dim)", urgent: false, daysLeft: days };
}

export const HEALTH_DISPLAY: Record<
  HealthStatus,
  { label: string; color: string; bg: string }
> = {
  healthy: { label: "Healthy", color: "#7CC084", bg: "rgba(120,180,120,.15)" },
  degraded: { label: "Degraded", color: "#ffb066", bg: "rgba(200,120,40,.2)" },
  failed: { label: "Failed", color: "#ffb3b3", bg: "rgba(180,30,30,.3)" },
  unknown: { label: "Not checked", color: "#9C9488", bg: "rgba(60,60,60,.25)" },
};

// Sort so the things needing attention float to the top.
export function integrationPriority(i: {
  health_status: HealthStatus;
  expires_at: string | null;
}): number {
  let score = 0;
  if (i.health_status === "failed") score += 100;
  else if (i.health_status === "degraded") score += 60;
  else if (i.health_status === "unknown") score += 20;
  const exp = expiryState(i.expires_at);
  if (exp.urgent) score += 80;
  else if (exp.daysLeft !== null && exp.daysLeft <= 14) score += 30;
  return score;
}
