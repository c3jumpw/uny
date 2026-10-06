import Link from "next/link";
import { getGuides } from "@/lib/content";

export const revalidate = 3600;

export const metadata = {
  title: "Guides & How-To's",
  description:
    "Practical, plain-language walkthroughs to get your business online, covering domain and hosting registration, professional company email and choosing a backend.",
};

export default async function GuidesPage() {
  const guides = await getGuides();

  return (
    <>
      <div className="page-header">
        <h1>Guides &amp; How-To&apos;s</h1>
        <p>Practical, plain-language walkthroughs to get your business online.</p>
      </div>

      <section className="section">
        <div className="container">
          {guides.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted)" }}>
              New guides are on the way. Check back soon.
            </p>
          ) : (
            <div className="grid">
              {guides.map((g) => (
                <article key={g.id} className="guide-card">
                  <Link href={`/guides/${g.slug}`} className="guide-thumb">
                    {g.hero_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.hero_image_url} alt="" />
                    ) : (
                      <DocIcon />
                    )}
                  </Link>
                  <div className="guide-body">
                    <h3>
                      <Link href={`/guides/${g.slug}`}>{g.title}</Link>
                    </h3>
                    {g.excerpt && <p>{g.excerpt}</p>}
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

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 2h8l6 6v14a0 0 0 010 0H6a2 2 0 01-2-2V4a2 2 0 012-2zm7 2v5h5l-5-5zM8 13h8v2H8v-2zm0 4h8v2H8v-2z" />
    </svg>
  );
}
