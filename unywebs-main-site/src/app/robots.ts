import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Draft previews are served at /guides/<slug>?preview=<token>.
      // This keeps well-behaved crawlers off them if a preview link is
      // ever shared, but it is the belt, not the braces: the preview
      // render also emits `noindex`, which is what actually keeps an
      // unpublished draft out of the index.
      disallow: ["/*?preview="],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
