import type { MetadataRoute } from "next";
import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/lib/mysql";
import { siteConfig } from "@/lib/site";

type SitemapRow = RowDataPacket & {
  id?: string;
  handle?: string;
  slug?: string;
  created_at: Date | string;
};

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function url(path: string) {
  return `${siteConfig.url}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: url("/"),
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: url("/search"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: url("/clans"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  try {
    const [users, groups, posts] = await Promise.all([
      queryRows<SitemapRow>("SELECT handle, created_at FROM users ORDER BY created_at DESC"),
      queryRows<SitemapRow>("SELECT slug, created_at FROM groups_clans ORDER BY created_at DESC"),
      queryRows<SitemapRow>("SELECT id, created_at FROM posts ORDER BY created_at DESC"),
    ]);

    return [
      ...staticRoutes,
      ...users.map((user) => ({
        url: url(`/profile/${user.handle}`),
        lastModified: asDate(user.created_at),
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...groups.map((group) => ({
        url: url(`/clan/${group.slug}`),
        lastModified: asDate(group.created_at),
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...posts.map((post) => ({
        url: url(`/post/${post.id}`),
        lastModified: asDate(post.created_at),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
