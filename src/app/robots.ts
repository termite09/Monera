import type { MetadataRoute } from "next";

const BASE_URL = "https://mymonera.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The app behind auth — also noindex'd at the page level as a belt-and-braces measure.
      disallow: ["/dashboard", "/transactions", "/insights", "/upload", "/settings", "/year-overview"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
