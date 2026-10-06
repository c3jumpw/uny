import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Server-side plumbing for the Unywebs admin (admin.unywebs.com).
//
// Every read and write here runs as the signed-in user. Permission comes
// from the database itself: is_site_admin() checks user_roles, and the
// row-level security policies on site_solutions, site_guides,
// site_redirects and the site-media bucket all call it. So this app needs
// no service-role key, and a bug in a route cannot reach any table the
// user could not already reach.

export type AdminContext = { supabase: SupabaseClient; user: User };

export async function requireSiteAdmin(): Promise<
  AdminContext | { error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to continue.", status: 401 };

  const { data: allowed, error } = await supabase.rpc("is_site_admin");
  if (error || allowed !== true) {
    return {
      error: "This account does not have access to the Unywebs admin.",
      status: 403,
    };
  }
  return { supabase, user };
}

// Who changed what. Written to site_content_events, the website's own log,
// kept apart from the UnyBase subscription log (admin_actions).
//
// Best-effort on purpose: a failed log entry must never undo or block an
// edit the person has already made. A failure is reported in the server
// logs rather than to the editor.
export async function logEvent(
  { supabase, user }: AdminContext,
  event: {
    action: string;
    target_kind: "solution" | "guide" | "media";
    target_slug?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("site_content_events").insert({
    actor_id: user.id,
    actor_email: user.email ?? "unknown",
    action: event.action,
    target_kind: event.target_kind,
    target_slug: event.target_slug ?? null,
    notes: event.notes ?? null,
    metadata: event.metadata ?? null,
  });
  if (error) console.warn("site_content_events insert skipped:", error.message);
}

// The public site this admin publishes to. Relative asset paths in the
// content (like /media/logos/x.png) live on that site, so previews here
// resolve them against it.
export function siteBase(): string {
  return (process.env.MARKETING_SITE_URL || "https://unywebs.com").replace(/\/$/, "");
}

// Ask the public site to rebuild the affected pages so a change is live in
// seconds. A failure never fails the save: the content is already stored,
// and the page catches up on its own hourly refresh.
export async function revalidateSite(
  paths?: string[]
): Promise<{ ok: boolean; detail?: string }> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!process.env.MARKETING_SITE_URL || !secret) {
    return {
      ok: false,
      detail: "MARKETING_SITE_URL or REVALIDATE_SECRET is not set, so the live site was not refreshed.",
    };
  }

  // The site keeps Vercel Authentication on its *.vercel.app hostnames.
  // The automation bypass is Vercel's supported way through for a machine
  // caller; once the custom domain serves the site it simply goes unused.
  const bypass = process.env.MARKETING_SITE_BYPASS_SECRET;

  try {
    const res = await fetch(`${siteBase()}/api/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret,
        ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
      },
      body: JSON.stringify(paths ? { paths } : {}),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, detail: `The site returned ${res.status}.` };
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "Could not reach the site." };
  }
}
