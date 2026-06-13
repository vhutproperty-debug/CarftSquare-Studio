import { getSiteUrl } from '@/lib/site';
import { getSitemapChunkCount } from '@/lib/seo/sitemap-data';

export const revalidate = 3600;

export async function GET() {
  const siteUrl = getSiteUrl();
  const chunkCount = await getSitemapChunkCount();
  const entries = Array.from({ length: chunkCount }, (_, id) => {
    const loc = `${siteUrl}/sitemap/${id}.xml`;
    return `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
