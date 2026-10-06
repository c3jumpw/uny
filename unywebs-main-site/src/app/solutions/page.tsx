import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { getSolutions } from "@/lib/content";

export const revalidate = 3600;

export const metadata = {
  title: "Solutions",
  description:
    "The best businesses use the best tools. Browse the Unywebs marketplace for hosting, a business phone, automation, project management, AI video and a managed backend.",
};

export default async function SolutionsPage() {
  const solutions = await getSolutions();

  return (
    <>
      <div className="page-header">
        <h1>The best businesses use the best tools</h1>
        <p>Select the tools below that best suit your business</p>
      </div>

      <section className="section">
        <div className="container">
          {solutions.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted)" }}>
              Our tool listings are being updated. Please check back shortly.
            </p>
          ) : (
            <div className="grid">
              {solutions.map((s) => (
                <article key={s.id} className="card">
                  <div className="card-head">
                    <BrandMark
                      name={s.name}
                      logoUrl={s.logo_url}
                      domain={s.domain}
                      brandColor={s.brand_color}
                    />
                    <h3>{s.name}</h3>
                  </div>

                  <p>{s.tagline || s.blurb}</p>

                  {/* Two distinct actions rather than one wrapping link:
                      signing up is the conversion, reading more is the
                      considered path, and a link inside a link is both
                      invalid markup and ambiguous to click. */}
                  <div className="card-actions">
                    {s.cta_url && (
                      <a
                        className="btn"
                        href={s.cta_url}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                      >
                        {s.cta_label}
                      </a>
                    )}
                    <Link className="card-explore" href={`/solutions/${s.slug}`}>
                      Explore &rarr;
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
