const SAFE_MIME_TYPE_REGEX = /^(image|video|audio)\/[\w.+-]+(\s*;.*)?$/i;
const SCRIPTABLE_MIME_TYPE_REGEX = /svg|xml/i;
const FALLBACK_MIME_TYPE = 'application/octet-stream';

// Media URLs are same-origin and can be opened as a page, so a sender-chosen type must never be scriptable
export function getSafeMimeType(mimeType: string) {
  return SAFE_MIME_TYPE_REGEX.test(mimeType) && !SCRIPTABLE_MIME_TYPE_REGEX.test(mimeType)
    ? mimeType
    : FALLBACK_MIME_TYPE;
}
