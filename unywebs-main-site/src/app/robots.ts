import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Draft previews carry a token in the query string; keeping
      // crawlers out of them stops an unpublished draft being indexed
      // if a preview link is ever shared.
      disallow: ["/api/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
