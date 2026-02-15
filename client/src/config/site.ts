export const SITE_NAME = 'FaxHistoria';
export const SITE_TAGLINE = 'AI Alternate History Strategy Game';
export const DEFAULT_SEO_DESCRIPTION =
  'FaxHistoria is an AI-driven alternate history strategy game where every turn rewrites diplomacy, economy, and warfare.';

const FALLBACK_SITE_URL = 'https://faxhistoria.vercel.app';

function normalizeSiteUrl(url: string) {
  return url.replace(/\/+$/, '');
}

export function getSiteUrl() {
  const envSiteUrl = import.meta.env.VITE_SITE_URL?.trim();
  if (envSiteUrl) {
    return normalizeSiteUrl(envSiteUrl);
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return normalizeSiteUrl(window.location.origin);
  }

  return FALLBACK_SITE_URL;
}

export function buildCanonicalUrl(pathname: string) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getSiteUrl()}${normalizedPath}`;
}
