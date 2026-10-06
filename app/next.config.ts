import type { NextConfig } from "next";

// The Unywebs website CMS used to live here at /admin/solutions and
// /admin/guides. It moved to the parent company's own admin, so UnyBase's
// admin is only about UnyBase. Old links forward to the new home.
const UNYWEBS_ADMIN = (process.env.UNYWEBS_ADMIN_URL || "https://admin.unywebs.com").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/admin/solutions", destination: `${UNYWEBS_ADMIN}/website/solutions`, permanent: true },
      { source: "/admin/guides", destination: `${UNYWEBS_ADMIN}/website/guides`, permanent: true },
      { source: "/admin/guides/:id", destination: `${UNYWEBS_ADMIN}/website/guides/:id`, permanent: true },
    ];
  },
};

export default nextConfig;
