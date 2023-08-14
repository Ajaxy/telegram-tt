const PROTOCOL_WHITELIST = new Set(['http:', 'https:', 'tg:', 'ton:', 'mailto:', 'tel:']);
const FALLBACK_PREFIX = 'https://';

export function ensureProtocol(url?: string) {
  if (!url) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(url);
    // eslint-disable-next-line no-script-url
    if (!PROTOCOL_WHITELIST.has(parsedUrl.protocol)) {
      return `${FALLBACK_PREFIX}${url}`;
    }

    return url;
  } catch (err) {
    return `${FALLBACK_PREFIX}${url}`;
  }
}
