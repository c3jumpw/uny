import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Guide bodies carry plain <img> tags from markdown, so next/image is
  // not in the path and no remote-pattern allowlist is needed. Images
  // come from two places and both resolve as ordinary URLs: files
  // committed under public/media, and Supabase Storage uploads made
  // from the admin.
  poweredByHeader: false,

  // unywebs.com used to be a WordPress site. When DNS moves to this one,
  // its old addresses are still in search results, bookmarks and shared
  // links, so each forwards permanently to the page that replaced it.
  async redirects() {
    return [
      { source: "/guides-how-tos", destination: "/guides", permanent: true },
      {
        source: "/your-businesss-app-needs-five-things",
        destination: "/guides/your-businesss-app-needs-five-things",
        permanent: true,
      },
      {
        source: "/registering-your-official-company-emails",
        destination: "/guides/registering-your-official-company-emails",
        permanent: true,
      },
      {
        source: "/wordpress-site-registration-with-unywebs",
        destination: "/guides/wordpress-site-registration-with-unywebs",
        permanent: true,
      },
      // The media export kept WordPress filenames, resized variants
      // included, so an old image URL maps straight onto /media.
      {
        source: "/wp-content/uploads/:year(\\d{4})/:month(\\d{2})/:file",
        destination: "/media/:file",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
