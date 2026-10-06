import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { siteUrl } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Unywebs | Online Marketplace for the Best Business Tools",
    template: "%s | Unywebs",
  },
  description:
    "Unywebs is an online marketplace of the tools entrepreneurs need to launch, run and grow a business, from hosting and email to automation.",
  openGraph: {
    siteName: "Unywebs",
    type: "website",
    locale: "en_US",
    // Default share card for pages that do not set their own image, so a
    // link to the home page or the tool list does not unfurl as bare text.
    images: [{ url: "/media/site-logo.png", width: 1227, height: 681, alt: "Unywebs" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@unywebs",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" href="/media/logos/favicon-64.png" />
        <link rel="apple-touch-icon" href="/media/logos/apple-touch-icon.png" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
