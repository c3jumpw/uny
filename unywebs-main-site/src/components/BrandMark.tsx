"use client";

import { useState } from "react";

// A tool's logo, sourced in three tiers so the page always looks
// deliberate rather than broken:
//
//   1. logo_url set in the admin — an uploaded file or a pasted URL.
//      This is the only tier that guarantees the real, correct asset,
//      so uploading one always wins.
//   2. the vendor's favicon, resolved from their domain at render time
//      in the visitor's browser.
//   3. a monogram on the brand's own colour.
//
// Tiers 2 and 3 exist because the real logos could not be bundled:
// fetching them is blocked from the build environment, and drawing a
// trademarked logo by hand risks shipping a subtly wrong version of
// someone else's brand, which is worse than not showing one.
//
// Text on the monogram is picked from the brand colour's luminance, so
// a near-black brand and a near-white one are both legible.

type Props = {
  name: string;
  logoUrl?: string | null;
  domain?: string | null;
  brandColor?: string | null;
  size?: number;
  rounded?: number;
};

function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return "#ffffff";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Relative luminance, sRGB coefficients.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? "#111827" : "#ffffff";
}

export function BrandMark({
  name,
  logoUrl,
  domain,
  brandColor,
  size = 44,
  rounded = 10,
}: Props) {
  // Tier index: 0 = admin logo, 1 = favicon, 2 = monogram.
  const [tier, setTier] = useState(logoUrl ? 0 : domain ? 1 : 2);

  const color = brandColor || "#1e73be";
  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: rounded,
    flexShrink: 0,
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
  };

  if (tier === 0 && logoUrl) {
    return (
      <span style={{ ...box, background: "#fff", border: "1px solid var(--border)" }}>
        {/* Inset so a mark drawn edge to edge, like most icon files, does
            not touch the tile's border. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`${name} logo`}
          width={size}
          height={size}
          style={{ width: "78%", height: "78%", objectFit: "contain" }}
          onError={() => setTier(domain ? 1 : 2)}
        />
      </span>
    );
  }

  if (tier === 1 && domain) {
    return (
      <span style={{ ...box, background: "#fff", border: "1px solid var(--border)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`}
          alt={`${name} logo`}
          width={size}
          height={size}
          style={{
            width: "72%",
            height: "72%",
            objectFit: "contain",
          }}
          onError={() => setTier(2)}
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span
      style={{
        ...box,
        background: color,
        color: readableOn(color),
        fontWeight: 700,
        fontSize: Math.round(size * 0.42),
        letterSpacing: "-0.02em",
      }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
