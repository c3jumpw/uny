import { cache } from "react";
import { supabase } from "./supabase";

export type Solution = {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  cta_label: string;
  cta_url: string | null;
  logo_url: string | null;
  category: string | null;
  sort_order: number;
  featured: boolean;
};

export type Guide = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  eyebrow: string | null;
  hero_image_url: string | null;
  body_markdown: string;
  status: string;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  author: string | null;
};

const SOLUTION_FIELDS =
  "id, slug, name, blurb, cta_label, cta_url, logo_url, category, sort_order, featured";

const GUIDE_FIELDS =
  "id, slug, title, excerpt, eyebrow, hero_image_url, body_markdown, status, published_at, seo_title, seo_description, og_image_url, author";

// `cache` dedupes within a single render pass, so a page that needs the
// same query for both generateMetadata and the component body only hits
// the database once.

export const getSolutions = cache(async (): Promise<Solution[]> => {
  const { data, error } = await supabase
    .from("site_solutions")
    .select(SOLUTION_FIELDS)
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error) {
    // A failed content fetch should not take the whole page down — the
    // shell, nav and footer are still worth serving, and the next
    // revalidation will pick the content back up.
    console.error("getSolutions failed:", error.message);
    return [];
  }
  return (data ?? []) as Solution[];
});

export const getGuides = cache(async (): Promise<Guide[]> => {
  const { data, error } = await supabase
    .from("site_guides")
    .select(GUIDE_FIELDS)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false });

  if (error) {
    console.error("getGuides failed:", error.message);
    return [];
  }
  return (data ?? []) as Guide[];
});

export const getGuide = cache(async (slug: string): Promise<Guide | null> => {
  const { data, error } = await supabase
    .from("site_guides")
    .select(GUIDE_FIELDS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error(`getGuide(${slug}) failed:`, error.message);
    return null;
  }
  return (data as Guide) ?? null;
});

// Draft preview.
//
// Goes through a security-definer function rather than a service-role
// client: this is a public deployment, and the only thing it should be
// able to do with an unpublished guide is render the one whose token
// the caller already has. The function enforces that server-side, so
// the anon key stays sufficient and no broad key ships with the site.
export async function getGuideForPreview(
  slug: string,
  token: string
): Promise<Guide | null> {
  if (!token || token.length < 16) return null;

  const { data, error } = await supabase.rpc("get_guide_preview", {
    p_slug: slug,
    p_token: token,
  });

  if (error) {
    console.error(`getGuideForPreview(${slug}) failed:`, error.message);
    return null;
  }
  const rows = (data ?? []) as Guide[];
  return rows[0] ?? null;
}

// Old slug -> current slug, so a renamed guide keeps its inbound links.
export const getRedirectTarget = cache(
  async (kind: "guide" | "solution", fromSlug: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("site_redirects")
      .select("to_slug")
      .eq("kind", kind)
      .eq("from_slug", fromSlug)
      .maybeSingle();

    if (error || !data) return null;
    return (data as { to_slug: string }).to_slug;
  }
);

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://unywebs.com"
  );
}
