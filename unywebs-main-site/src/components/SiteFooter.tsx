import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="brand-mark" aria-hidden="true">
        U
      </div>
      <div className="footer-links">
        <Link href="/">Home</Link>
        <Link href="/solutions">Our Solutions</Link>
        <Link href="/guides">Guides &amp; How-To&apos;s</Link>
        <Link href="/get-started">Get Started</Link>
      </div>
      <p>&copy; {new Date().getFullYear()} Unywebs, LLC. | All Rights Reserved</p>
    </footer>
  );
}
