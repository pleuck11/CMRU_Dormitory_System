import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://yayee-dorm.vercel.app";
  
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/details_room", "/auth"],
      disallow: ["/admin/", "/tenant/", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
