import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BrandMark } from "@/components/BrandMark";
import { getSolution, getSolutions, siteUrl } from "@/lib/content";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const solutions = await getSolutions();
  return solutions.map((s) => ({ slug: s.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSolution(slug);
  if (!s) return { title: "Tool not found" };

  const description = s.overview || s.blurb;
  return {
    title: s.name,
    description,
    alternates: { canonical: `${siteUrl()}/solutions/${s.slug}` },
    openGraph: {
      title: `${s.name} | Unywebs`,
      description,
      type: "website",
      url: `${siteUrl()}/solutions/${s.slug}`,
    },
  };
}

export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  const solution = await getSolution(slug);
  if (!solution) notFound();

  const all = await getSolutions();
  const others = all.filter((s) => s.slug !== solution.slug).slice(0, 3);
  const brand = solution.brand_color || "#1e73be";

  return (
    <>
      {/* Brand-tinted header. The wash is the vendor's own colour at low
          opacity, so each tool's page feels like its own place without
          leaving the Unywebs system. */}
      <section
        className="tool-hero"
        style={
          {
            "--brand-tint": `${brand}14`,
            "--brand-edge": `${brand}33`,
          } as React.CSSProperties
        }
      >
        <div className="container">
          <p className="tool-crumb">
            <Link href="/solutions">Our Solutions</Link>
            <span aria-hidden="true"> / </span>
            <span>{solution.name}</span>
          </p>

          <div className="tool-lockup">
            <BrandMark
              name={solution.name}
              logoUrl={solution.logo_url}
              domain={solution.domain}
              brandColor={solution.brand_color}
              size={64}
              rounded={14}
            />
            <div>
              <h1>{solution.name}</h1>
              {solution.category && (
                <span className="tool-cat">{solution.category}</span>
              )}
            </div>
          </div>

          {solution.tagline && <p className="tool-tagline">{solution.tagline}</p>}

          <div className="tool-actions">
            {solution.cta_url && (
              <a
                className="btn"
                href={solution.cta_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
              >
                {solution.cta_label} <span className="arrow">&rarr;</span>
              </a>
            )}
            {solution.domain && (
              <a
                className="tool-site"
                href={`https://${solution.domain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {solution.domain}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Overview: one generous block, set large with room to breathe. */}
      {(solution.overview || solution.blurb) && (
        <section className="section">
          <div className="container tool-narrow">
            <p className="tool-overview">{solution.overview || solution.blurb}</p>
          </div>
        </section>
      )}

      {/* Capabilities. Four at most, two up, lots of air between them. */}
      {solution.features?.length > 0 && (
        <section className="section section-soft">
          <div className="container">
            <p className="eyebrow">What you get</p>
            <div className="tool-features">
              {solution.features.map((f, i) => (
                <div className="tool-feature" key={i}>
                  <span
                    className="tool-feature-rule"
                    style={{ background: brand }}
                    aria-hidden="true"
                  />
                  <h2>{f.title}</h2>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Who it suits: deliberately one line, given the whole width. */}
      {solution.best_for && (
        <section className="section">
          <div className="container tool-narrow">
            <p className="eyebrow">Best for</p>
            <p className="tool-bestfor">{solution.best_for}</p>
          </div>
        </section>
      )}

      {/* Close. Pricing is framed as indicative and sends people to the
          vendor, because their price is theirs to change, not ours. */}
      <section className="section">
        <div className="container">
          <div
            className="tool-cta"
            style={
              {
                "--brand-tint": `${brand}12`,
                "--brand-edge": `${brand}2e`,
              } as React.CSSProperties
            }
          >
            <h2>Ready to try {solution.name}?</h2>
            {solution.pricing_note && (
              <p className="tool-pricing">{solution.pricing_note}</p>
            )}
            {solution.cta_url && (
              <a
                className="btn"
                href={solution.cta_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
              >
                {solution.cta_label} <span className="arrow">&rarr;</span>
              </a>
            )}
            <p className="tool-pricing-fine">
              Pricing shown is indicative and set by the provider. Check their
              site for current rates.
            </p>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="section section-soft">
          <div className="container">
            <p className="eyebrow">More tools</p>
            <div className="grid">
              {others.map((s) => (
                <Link key={s.id} href={`/solutions/${s.slug}`} className="card tool-mini">
                  <BrandMark
                    name={s.name}
                    logoUrl={s.logo_url}
                    domain={s.domain}
                    brandColor={s.brand_color}
                  />
                  <h3>{s.name}</h3>
                  <p>{s.tagline || s.blurb}</p>
                </Link>
              ))}
            </div>
            <p style={{ marginTop: 32 }}>
              <Link href="/solutions">&larr; See all tools</Link>
            </p>
          </div>
        </section>
      )}
    </>
  );
}
