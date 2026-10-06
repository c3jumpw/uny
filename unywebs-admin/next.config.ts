import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    // /web-admin was the first name floated for this area. The whole
    // subdomain is the admin now, so the old path just lands on the
    // overview rather than 404ing if anyone bookmarked it.
    return [{ source: "/web-admin/:path*", destination: "/", permanent: false }];
  },
  async headers() {
    // Nothing on an admin host should ever be framed or indexed.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
