import { SVG_EXTENSIONS } from '../../config';

const UNSAFE_MIME_TYPES = new Set(['text/html', 'image/svg+xml']);
const UNSAFE_MIME_SUBTYPES = new Set(['html', 'svg+xml', 'xhtml+xml', 'xml']);
const UNSAFE_EXTENSIONS = new Set([
  ...SVG_EXTENSIONS,
  'htm', 'html', 'svg', 'm4v', 'm3u', 'm3u8', 'xhtml', 'xml',
]);

export function isIpRevealingMedia({ mimeType, extension }: { mimeType?: string; extension: string }) {
  const normalizedMimeType = mimeType?.split(';')[0].trim().toLowerCase();
  const normalizedMimeSubtype = normalizedMimeType?.split('/').pop()?.trim();
  const normalizedExtension = extension.trim().toLowerCase();

  if (normalizedMimeType && UNSAFE_MIME_TYPES.has(normalizedMimeType)) {
    return true;
  }

  if (normalizedMimeSubtype && UNSAFE_MIME_SUBTYPES.has(normalizedMimeSubtype)) {
    return true;
  }

  if (UNSAFE_EXTENSIONS.has(normalizedExtension)) {
    return true;
  }

  return false;
}
