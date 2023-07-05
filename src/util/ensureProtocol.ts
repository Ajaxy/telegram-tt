const PROTOCOL_WHITELIST = new Set(['http:', 'https:', 'tg:', 'ton:', 'mailto:', 'tel:']);
// HTTP was chosen by default as a fix for https://bugs.telegram.org/c/10712.
// It is also the default protocol in the official TDesktop client.
const FALLBACK_PREFIX = 'http://';

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
