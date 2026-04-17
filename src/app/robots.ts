import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/search", "/clans", "/profile/", "/clan/", "/post/"],
        disallow: [
          "/api/",
          "/admin",
          "/auth/",
          "/messages",
          "/notifications",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
