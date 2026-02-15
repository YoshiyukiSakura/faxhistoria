import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FALLBACK_SITE_URL = 'https://faxhistoria.vercel.app';

function normalizeSiteUrl(url) {
  return url.replace(/\/+$/, '');
}

function getSiteUrl() {
  const configuredUrl = process.env.VITE_SITE_URL?.trim() || process.env.SITE_URL?.trim();

  if (configuredUrl) {
    return normalizeSiteUrl(configuredUrl);
  }

  if (process.env.VERCEL_URL) {
    return normalizeSiteUrl(`https://${process.env.VERCEL_URL}`);
  }

  return FALLBACK_SITE_URL;
}

const siteUrl = getSiteUrl();
const today = new Date().toISOString().slice(0, 10);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(scriptDir, '../public');

const sitemapUrls = [
  {
    path: '/',
    changefreq: 'daily',
    priority: '1.0',
  },
];

const robotsContent = [
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${siteUrl}/sitemap.xml`,
  '',
].join('\n');

const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    ({ path, changefreq, priority }) => `  <url>\n    <loc>${siteUrl}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`;

await mkdir(publicDir, { recursive: true });
await writeFile(resolve(publicDir, 'robots.txt'), robotsContent, 'utf8');
await writeFile(resolve(publicDir, 'sitemap.xml'), sitemapContent, 'utf8');

console.log(`[seo] generated robots.txt and sitemap.xml for ${siteUrl}`);
