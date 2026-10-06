import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { getSolutions } from "@/lib/content";

// Rebuilt on publish via /api/revalidate; the hourly figure is only a
// backstop in case a revalidation call is ever missed.
export const revalidate = 3600;

export const metadata = {
  title: "Home",
  description:
    "Get the best tools for your business. Unywebs is a curated marketplace of software and services that help entrepreneurs launch, run, and scale.",
};

export default async function HomePage() {
  const solutions = await getSolutions();
  const featured = solutions.slice(0, 3);

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div>
            <p className="eyebrow">Your online marketplace</p>
            <h1>Get the best tools for your business</h1>
            <p className="lead">
              A curated marketplace of software and services that help
              entrepreneurs launch, run and scale without the guesswork.
            </p>
            <Link href="/solutions" className="btn">
              View Our Tools <span className="arrow">&rarr;</span>
            </Link>
          </div>
          <div className="hero-art" aria-hidden="true">
            <HeroArt />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="split">
            <div className="split-art" aria-hidden="true">
              <AboutArt />
            </div>
            <div>
              <p className="eyebrow">Real tools, no guesswork</p>
              <h2>Built for people who just need things to work</h2>
              <p>
                <strong>
                  Make tech less frustrating for business with Unywebs.
                </strong>{" "}
                We&apos;ve built a place that cuts through the clutter and gives
                you clear tools that help you move.
              </p>
              <Link href="/get-started" className="btn outline">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section section-soft">
          <div className="container">
            <div className="section-heading">
              <p className="eyebrow">What we offer</p>
              <h2>Everything under one roof</h2>
            </div>
            <div className="grid">
              {featured.map((s) => (
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
                  <Link href={`/solutions/${s.slug}`} className="btn">
                    Explore
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function HeroArt() {
  return (
    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img">
      <defs>
        <linearGradient id="hg1" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#1e73be" stopOpacity="0.9" />
          <stop offset="1" stopColor="#155a94" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="hg2" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#f7a600" />
          <stop offset="1" stopColor="#ffcf5c" />
        </linearGradient>
      </defs>
      <rect x="30" y="40" width="220" height="140" rx="14" fill="url(#hg1)" />
      <rect x="50" y="60" width="90" height="10" rx="5" fill="#fff" opacity="0.9" />
      <rect x="50" y="80" width="140" height="6" rx="3" fill="#fff" opacity="0.55" />
      <rect x="50" y="92" width="120" height="6" rx="3" fill="#fff" opacity="0.55" />
      <rect x="50" y="115" width="70" height="30" rx="15" fill="url(#hg2)" />
      <rect x="130" y="115" width="60" height="30" rx="15" fill="#fff" opacity="0.25" />
      <rect x="230" y="120" width="140" height="90" rx="12" fill="#fff" stroke="#e2e8f0" />
      <circle cx="255" cy="150" r="10" fill="#f7a600" />
      <rect x="275" y="145" width="80" height="6" rx="3" fill="#94a2ba" />
      <rect x="275" y="158" width="60" height="6" rx="3" fill="#cbd5e1" />
      <rect x="245" y="175" width="110" height="6" rx="3" fill="#cbd5e1" />
      <rect x="245" y="188" width="90" height="6" rx="3" fill="#e2e8f0" />
      <rect x="80" y="200" width="180" height="65" rx="12" fill="#fff" stroke="#e2e8f0" />
      <circle cx="105" cy="232" r="14" fill="#1e73be" />
      <rect x="130" y="220" width="110" height="8" rx="4" fill="#94a2ba" />
      <rect x="130" y="235" width="80" height="6" rx="3" fill="#cbd5e1" />
    </svg>
  );
}

function AboutArt() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img">
      <rect x="20" y="20" width="70" height="70" rx="10" fill="#1e73be" opacity="0.9" />
      <rect x="100" y="20" width="70" height="70" rx="10" fill="#f7a600" opacity="0.9" />
      <rect x="20" y="100" width="70" height="70" rx="10" fill="#94a2ba" opacity="0.7" />
      <rect x="100" y="100" width="70" height="70" rx="10" fill="#155a94" opacity="0.9" />
      <circle cx="55" cy="55" r="16" fill="#fff" />
      <path
        d="M 130 40 L 155 65 L 140 80"
        stroke="#fff"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="35" y="120" width="40" height="6" rx="3" fill="#fff" />
      <rect x="35" y="135" width="30" height="6" rx="3" fill="#fff" opacity="0.7" />
      <circle cx="135" cy="135" r="20" fill="#fff" />
    </svg>
  );
}
