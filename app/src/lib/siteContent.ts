import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, canAccessAdmin } from "@/lib/admin";
import type { SolutionRow, GuideRow } from "@/lib/siteContentShared";

// Re-exported so server code has one import for CMS concerns.
export {
  slugify,
  affiliateUrlWarning,
} from "@/lib/siteContentShared";
export type { SolutionRow, GuideRow } from "@/lib/siteContentShared";

// Shared plumbing for the marketing-site CMS (/admin/solutions and
// /admin/guides).
//
// Roles still come from env vars in this phase, so the gate is a
// server-side check in the route rather than an RLS policy, and the
// write itself goes through the service role. The CMS tables also
// carry is_site_admin() policies, so when roles move into the database
// the same code keeps working with a narrower key.

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Every CMS write funnels through this. Returns the caller's identity
// on success so the route can record who did what.
export async function requireContentAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "unauthorized" as const, status: 401 };

  const role = getUserRole(user.email);
  if (!canAccessAdmin(role)) {
    return { error: "forbidden" as const, status: 403 };
  }

  const admin = serviceClient();
  if (!admin) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not configured; content cannot be saved." as const,
      status: 500,
    };
  }

  return { user, role, admin };
}

// Ask the marketing site to rebuild the affected pages. Publishing is
// the moment the editor expects to see the change live, so this runs
// inline — but a failure here must never fail the save. The content is
// already in the database; the worst case is the page catching up on
// its own revalidation window instead of in two seconds.
export async function revalidateSite(paths?: string[]): Promise<{
  ok: boolean;
  detail?: string;
}> {
  const base = process.env.MARKETING_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;

  if (!base || !secret) {
    return {
      ok: false,
      detail:
        "MARKETING_SITE_URL or REVALIDATE_SECRET is not set, so the live site was not refreshed.",
    };
  }

  // The marketing site keeps Vercel Authentication on for its
  // *.vercel.app hostnames, which would bounce this call before it
  // reached the route. The automation bypass secret is Vercel's
  // intended way through for machine callers, so we send it when one is
  // configured rather than weakening the project's protection. Once the
  // custom domain is live this header stops mattering — custom domains
  // are exempt — and it is harmless to keep sending.
  const bypass = process.env.MARKETING_SITE_BYPASS_SECRET;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret,
        ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
      },
      body: JSON.stringify(paths ? { paths } : {}),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, detail: `Site returned ${res.status}.` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "Could not reach the site.",
    };
  }
}

export function siteUrlFor(kind: "guide", slug: string): string {
  const base = (process.env.MARKETING_SITE_URL || "https://unywebs.com").replace(
    /\/$/,
    ""
  );
  return `${base}/${kind}s/${slug}`;
}
