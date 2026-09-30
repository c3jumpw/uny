import { getSolutions } from "@/lib/content";

export const revalidate = 3600;

export const metadata = {
  title: "Solutions",
  description:
    "The best businesses use the best tools. Browse the Unywebs marketplace — hosting, business phone, automation, project management, AI video, and a managed backend.",
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
                  <div className="icon" aria-hidden="true">
                    {s.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo_url} alt="" />
                    ) : (
                      s.name.charAt(0)
                    )}
                  </div>
                  <h3>{s.name}</h3>
                  <p>{s.blurb}</p>
                  {s.cta_url && (
                    <a
                      className="btn"
                      href={s.cta_url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                    >
                      {s.cta_label} <span className="arrow">&rarr;</span>
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
