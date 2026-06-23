const TYPE_HTML = 'text/html';
const CANONICAL_LINK_SELECTOR = 'link[rel~="canonical" i]';
const ALLOWED_EMBED_URL_PROTOCOLS = new Set(['http:', 'https:']);

export function extractInstantViewEmbedUrl(html: string) {
  try {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(html, TYPE_HTML);
    const canonicalLink = parsedDocument.querySelector<HTMLLinkElement>(CANONICAL_LINK_SELECTOR);
    const href = canonicalLink?.getAttribute('href')?.trim();

    return href ? normalizeEmbedUrl(href) : undefined;
  } catch (err) {
    return undefined;
  }
}

function normalizeEmbedUrl(href: string) {
  try {
    const url = new URL(href);

    return ALLOWED_EMBED_URL_PROTOCOLS.has(url.protocol) ? url.href : undefined;
  } catch (err) {
    return undefined;
  }
}
