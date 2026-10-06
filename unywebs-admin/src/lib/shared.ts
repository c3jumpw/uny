// Types and pure helpers for the Unywebs website CMS.
//
// Kept free of server-only imports (next/headers, the Supabase server
// client) so client components can import it without dragging server
// code into the browser bundle. Anything both sides need lives here.

export type SolutionFeature = { title: string; body: string };

export type SolutionRow = {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  cta_label: string;
  cta_url: string | null;
  logo_url: string | null;
  category: string | null;
  status: "draft" | "published" | "archived";
  sort_order: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
  // Detail-page fields, surfaced at /solutions/<slug> on the site.
  tagline: string | null;
  overview: string | null;
  features: SolutionFeature[];
  best_for: string | null;
  pricing_note: string | null;
  domain: string | null;
  brand_color: string | null;
};

export type GuideRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  eyebrow: string | null;
  hero_image_url: string | null;
  body_markdown: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  slug_locked: boolean;
  author: string | null;
  sort_order: number;
  preview_token: string;
  created_at: string;
  updated_at: string;
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Surfaced next to the affiliate URL field. These are warnings, never
// blocks. A partner may legitimately use a bare link, and the editor
// knows their programs better than a regex does.
export function affiliateUrlWarning(
  url: string | null | undefined
): string | null {
  if (!url) return "No link set. The card will show without a signup button.";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "This doesn't look like a valid URL.";
  }
  if (parsed.protocol !== "https:") {
    return "This link is not https. Most affiliate programs drop tracking on insecure links.";
  }
  const hasParams = parsed.search.length > 1;
  const hasPath = parsed.pathname.replace(/\/$/, "").length > 0;
  if (!hasParams && !hasPath) {
    return "This is a bare homepage with no tracking parameter. Check it is really your referral link.";
  }
  return null;
}

// Content stores site assets as paths on the public site (/media/...).
// Anywhere this admin renders one, it has to point at that site, not at
// admin.unywebs.com where the file does not exist.
export function resolveAssetUrl(url: string | null | undefined, base: string): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${base}${url}` : url;
}
