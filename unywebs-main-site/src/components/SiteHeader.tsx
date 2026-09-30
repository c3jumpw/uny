"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/solutions", label: "Our Solutions" },
  { href: "/guides", label: "Guides & How-To's" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The real logo arrives when media is uploaded to public/media. Until
  // then the wordmark stands in, so a missing file never leaves a
  // broken image in the header.
  const [logoOk, setLogoOk] = useState(true);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="site-header">
      <nav className="nav">
        <Link href="/" className="logo" onClick={() => setOpen(false)}>
          {logoOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/media/site-logo.png"
              alt="Unywebs"
              onError={() => setLogoOk(false)}
            />
          ) : (
            <>
              <span className="brand-mark" aria-hidden="true">
                U
              </span>
              <span>unywebs</span>
            </>
          )}
        </Link>

        <button
          className="menu-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>

        <ul className={open ? "open" : undefined}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={isActive(l.href) ? "active" : undefined}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/get-started"
              className="cta-btn"
              onClick={() => setOpen(false)}
            >
              Get Started
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
