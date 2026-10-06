"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLockup } from "@/components/BrandLockup";

// The sidebar mirrors the company structure: Unywebs owns the website and
// its products. The website is edited here; each product keeps its own
// operational console, linked out rather than duplicated.

type Props = {
  email: string | null;
  siteUrl: string;
  unybaseAppUrl: string;
};

export function AdminNav({ email, siteUrl, unybaseAppUrl }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function active(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="side">
      <Link href="/" aria-label="Unywebs Admin overview">
        <BrandLockup />
      </Link>
      <div className="mark-stripe" aria-hidden="true">
        <span /><span /><span /><span />
      </div>

      <nav className="nav-group" aria-label="Overview">
        <Link href="/" className={`nav-link${active("/") ? " active" : ""}`}>
          Overview
        </Link>
      </nav>

      <nav className="nav-group" aria-label="Website">
        <div className="nav-label">Website</div>
        <Link
          href="/website/solutions"
          className={`nav-link${active("/website/solutions") ? " active" : ""}`}
        >
          Solutions
        </Link>
        <Link
          href="/website/guides"
          className={`nav-link${active("/website/guides") ? " active" : ""}`}
        >
          Guides
        </Link>
        <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="nav-link">
          View site <span className="nav-ext" aria-hidden="true">↗</span>
        </a>
      </nav>

      <nav className="nav-group" aria-label="Products">
        <div className="nav-label">Products</div>
        <a
          href={`${unybaseAppUrl}/admin`}
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link"
        >
          UnyBase <span className="nav-ext" aria-hidden="true">↗</span>
        </a>
      </nav>

      <div className="side-foot">
        {email ? (
          <span>
            Signed in as <strong>{email}</strong>
          </span>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: "6px 12px", fontSize: "0.82rem", alignSelf: "flex-start" }}
          onClick={signOut}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
