import { useEffect } from 'react';
import {
  DEFAULT_SEO_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  buildCanonicalUrl,
  getSiteUrl,
} from '../../config/site';

interface SeoHeadProps {
  title: string;
  description?: string;
  pathname: string;
  robots?: string;
}

function upsertMetaByName(name: string, content: string) {
  let node = document.head.querySelector(`meta[name="${name}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('name', name);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string) {
  let node = document.head.querySelector(`meta[property="${property}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute('property', property);
    document.head.appendChild(node);
  }
  node.setAttribute('content', content);
}

function upsertCanonical(url: string) {
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', 'canonical');
    document.head.appendChild(node);
  }
  node.setAttribute('href', url);
}

export function SeoHead({
  title,
  description = DEFAULT_SEO_DESCRIPTION,
  pathname,
  robots = 'index, follow',
}: SeoHeadProps) {
  useEffect(() => {
    const canonicalUrl = buildCanonicalUrl(pathname);
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

    document.title = fullTitle;

    upsertMetaByName('description', description);
    upsertMetaByName('robots', robots);
    upsertMetaByName('googlebot', robots);

    upsertMetaByProperty('og:type', 'website');
    upsertMetaByProperty('og:site_name', SITE_NAME);
    upsertMetaByProperty('og:title', fullTitle);
    upsertMetaByProperty('og:description', description);
    upsertMetaByProperty('og:url', canonicalUrl);

    upsertMetaByName('twitter:card', 'summary_large_image');
    upsertMetaByName('twitter:title', fullTitle);
    upsertMetaByName('twitter:description', description);

    upsertCanonical(canonicalUrl);

    const existingLdJson = document.head.querySelector(
      'script[data-faxhistoria="website-jsonld"]',
    );
    const ldJson = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: SITE_TAGLINE,
      url: getSiteUrl(),
    };

    if (existingLdJson) {
      existingLdJson.textContent = JSON.stringify(ldJson);
    } else {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-faxhistoria', 'website-jsonld');
      script.textContent = JSON.stringify(ldJson);
      document.head.appendChild(script);
    }
  }, [description, pathname, robots, title]);

  return null;
}
