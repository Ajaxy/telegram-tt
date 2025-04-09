import { DEBUG } from '../../config';
import convertPunycode from '../../lib/punycode';

const PROTOCOL_WHITELIST = new Set(['http:', 'https:', 'tg:', 'ton:', 'mailto:', 'tel:']);
const FALLBACK_PREFIX = 'https://';

export function ensureProtocol(url: string) {
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

export function getUnicodeUrl(url: string) {
  const href = ensureProtocol(url);

  try {
    const parsedUrl = new URL(href);
    const unicodeDomain = convertPunycode(parsedUrl.hostname);

    try {
      return decodeURI(parsedUrl.toString()).replace(parsedUrl.hostname, unicodeDomain);
    } catch (err) { // URL contains invalid sequences, keep it as it is
      return parsedUrl.toString().replace(parsedUrl.hostname, unicodeDomain);
    }
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('SafeLink.getDecodedUrl error ', url, error);
    }
  }

  return undefined;
}

export function isMixedScriptUrl(url: string): boolean {
  let domain;
  try {
    domain = convertPunycode(new URL(ensureProtocol(url)!).hostname);
  } catch (e) {
    return true; // If URL is invalid, treat it as mixed script
  }

  let hasLatin = false;
  let hasNonLatin = false;

  for (const char of Array.from(domain)) {
    if (!/\p{L}/u.test(char)) continue; // Ignore non-letter characters

    if (/\p{Script=Latin}/u.test(char)) {
      hasLatin = true;
    } else {
      hasNonLatin = true;
    }

    if (hasLatin && hasNonLatin) return true;
  }

  return false;
}
