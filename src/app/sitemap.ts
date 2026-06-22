import type { MetadataRoute } from "next";

const BASE_URL = "https://mymonera.com";

// Only public, indexable routes belong here. The signed-in app (/dashboard,
// /transactions, …) is intentionally excluded and noindex'd via the auth layout.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: BASE_URL, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
