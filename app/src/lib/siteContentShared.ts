// Types and pure helpers for the marketing-site CMS.
//
// Split out from siteContent.ts deliberately: that module reaches for
// next/headers and the service-role key, so importing it from a client
// component drags server-only code into the browser bundle. Anything
// both sides need lives here instead.

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
// blocks — a partner may legitimately use a bare link, and the editor
// knows their programs better than a regex does.
export function affiliateUrlWarning(
  url: string | null | undefined
): string | null {
  if (!url) return "No link set — the card will render without a button.";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "This doesn't look like a valid URL.";
  }
  if (parsed.protocol !== "https:") {
    return "Not https — most affiliate programs drop tracking on insecure links.";
  }
  const hasParams = parsed.search.length > 1;
  const hasPath = parsed.pathname.replace(/\/$/, "").length > 0;
  if (!hasParams && !hasPath) {
    return "Bare homepage with no path or tracking parameter — check this is really your referral link.";
  }
  return null;
}
