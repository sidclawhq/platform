import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://sidclaw.com';

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/#features`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/#demos`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/#pricing`, changeFrequency: 'monthly', priority: 0.7 },
  ];
}
