import Link from "next/link";
import { getGuides } from "@/lib/content";

export const revalidate = 3600;

export const metadata = {
  title: "Get Started",
  description:
    "A few practical next steps to get your business online with Unywebs — register your site, set up official email, and choose a backend.",
};

export default async function GetStartedPage() {
  const guides = await getGuides();
  const steps = guides.slice(0, 3);

  return (
    <>
      <div className="page-header">
        <h1>Get Started with Unywebs</h1>
        <p>
          A few practical next steps to pick the tools you need and get moving.
        </p>
      </div>

      <section className="section">
        <div className="container">
          {steps.length > 0 && (
            <div className="grid">
              {steps.map((g, i) => (
                <article key={g.id} className="card">
                  <div className="icon" aria-hidden="true">
                    {i + 1}
                  </div>
                  <h3>{g.title}</h3>
                  <p>{g.excerpt}</p>
                  <Link href={`/guides/${g.slug}`} className="btn">
                    Read the guide
                  </Link>
                </article>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 48,
              padding: 40,
              borderRadius: 16,
              textAlign: "center",
              background:
                "linear-gradient(135deg, var(--bg-tint), #d8e8f7)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "1.6rem" }}>
              Ready to browse the full toolkit?
            </h2>
            <p style={{ color: "var(--muted)", marginBottom: 24 }}>
              Every recommended tool, with a short description and a link to get
              started.
            </p>
            <Link href="/solutions" className="btn">
              View Our Solutions
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
