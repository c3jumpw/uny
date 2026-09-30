import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Guide bodies carry plain <img> tags from markdown, so next/image is
  // not in the path and no remote-pattern allowlist is needed. Images
  // come from two places and both resolve as ordinary URLs: files
  // committed under public/media, and Supabase Storage uploads made
  // from the admin.
  poweredByHeader: false,
};

export default nextConfig;
