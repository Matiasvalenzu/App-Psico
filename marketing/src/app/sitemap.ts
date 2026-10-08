import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-10-08")
  return [
    {
      url: "https://psiconex.cl/",
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://psiconex.cl/privacidad",
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://psiconex.cl/terminos",
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
