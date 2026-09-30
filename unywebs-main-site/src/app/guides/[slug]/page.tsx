import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import {
  getGuide,
  getGuides,
  getGuideForPreview,
  getRedirectTarget,
  siteUrl,
} from "@/lib/content";

export const revalidate = 3600;

// Published guides are pre-rendered at build; anything published later
// is rendered on first request and then cached, so a new article is
// live without a deploy.
export const dynamicParams = true;

export async function generateStaticParams() {
  const guides = await getGuides();
  return guides.map((g) => ({ slug: g.slug }));
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return { title: "Guide not found" };

  const title = guide.seo_title || guide.title;
  const description = guide.seo_description || guide.excerpt;
  const image = guide.og_image_url || guide.hero_image_url || undefined;

  return {
    title,
    description,
    alternates: { canonical: `${siteUrl()}/guides/${guide.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${siteUrl()}/guides/${guide.slug}`,
      publishedTime: guide.published_at ?? undefined,
      images: image ? [image] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function GuidePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;

  let guide = await getGuide(slug);
  let isPreview = false;

  // Unpublished draft, opened with its token from the admin's Preview
  // button. Never indexed, and the banner makes the state obvious so a
  // draft is not mistaken for the live page.
  if (!guide && preview) {
    guide = await getGuideForPreview(slug, preview);
    isPreview = Boolean(guide);
  }

  if (!guide) {
    // The slug may have been renamed after publishing. Send the reader
    // (and the crawler) on to the current URL rather than a 404.
    const target = await getRedirectTarget("guide", slug);
    if (target) permanentRedirect(`/guides/${target}`);
    notFound();
  }

  const published = guide.published_at
    ? new Date(guide.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.seo_description || guide.excerpt,
    datePublished: guide.published_at ?? undefined,
    author: { "@type": "Organization", name: guide.author || "Unywebs" },
    publisher: { "@type": "Organization", name: "Unywebs" },
    mainEntityOfPage: `${siteUrl()}/guides/${guide.slug}`,
    image: guide.og_image_url || guide.hero_image_url || undefined,
  };

  return (
    <>
      {isPreview && (
        <div className="preview-banner">
          Draft preview — this guide is not published and is not visible to
          anyone else.
        </div>
      )}

      {!isPreview && (
        <script
          type="application/ld+json"
          // Serialized server-side from our own database row, not from
          // anything a visitor supplies.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <article className="article">
        {guide.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="article-hero" src={guide.hero_image_url} alt="" />
        )}

        {guide.eyebrow && <p className="eyebrow">{guide.eyebrow}</p>}
        <h1>{guide.title}</h1>
        {guide.excerpt && <p className="excerpt">{guide.excerpt}</p>}
        <p className="meta">
          {guide.author || "Unywebs"}
          {published ? ` · ${published}` : ""}
        </p>

        <Markdown>{guide.body_markdown}</Markdown>

        <p style={{ marginTop: 48 }}>
          <Link href="/guides">&larr; Back to all guides</Link>
        </p>
      </article>
    </>
  );
}
