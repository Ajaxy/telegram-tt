import { SVG_EXTENSIONS } from '../../config';

const UNSAFE_MIME_TYPES = new Set(['text/html', 'image/svg+xml']);
const UNSAFE_EXTENSIONS = new Set([
  ...SVG_EXTENSIONS,
  'htm', 'html', 'svg', 'm4v', 'm3u', 'm3u8', 'xhtml', 'xml',
]);

export function isIpRevealingMedia({ mimeType, extension }: { mimeType?: string; extension: string }) {
  if (mimeType && UNSAFE_MIME_TYPES.has(mimeType)) {
    return true;
  }

  if (UNSAFE_EXTENSIONS.has(extension)) {
    return true;
  }

  return false;
}
