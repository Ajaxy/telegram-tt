/**
 * JSON-safe media descriptor for Electron / desktop download via web worker only.
 * Aligns with deferred media metadata from scrapers (id, accessHash, fileReference, dcId).
 */
export type ApiDesktopDeferredMedia = {
  /** Correlates `tg-download-chunk` postMessages; generated if omitted. */
  downloadId?: string;
  /** Ignored; for app-side tagging (e.g. source: "telegram"). */
  source?: string;
  /** Telegram file / photo id (decimal string; may exceed JS safe integer). */
  id: string;
  accessHash: string;
  /** Standard or URL-safe base64 file reference bytes. */
  fileReference: string;
  dcId: number;
  mediaType: 'document' | 'photo' | 'video' | 'audio' | 'voice' | 'other';
  /** Photo / video thumb letter (e.g. y); omit for full document download. */
  thumbSize?: string;
  /** Byte size hint for download (recommended for large files). */
  size?: number | string;
};
