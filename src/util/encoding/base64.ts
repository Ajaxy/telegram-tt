import { bufferFromBase64, bufferToUtf8 } from './buffer';

const RE_BASE64_URL = /^[A-Za-z0-9_-]+={0,2}$/;

export function isBase64Url(base64Url: string) {
  return RE_BASE64_URL.test(base64Url);
}

export function base64UrlToBase64(base64Url: string): string {
  const base64Encoded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64Url.length % 4 === 0 ? '' : '='.repeat(4 - (base64Url.length % 4));
  const base64WithPadding = base64Encoded + padding;
  return base64WithPadding;
}

export function base64UrlToBuffer(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64UrlToBase64(base64Url);
  return bufferFromBase64(base64);
}

export function base64UrlToString(base64Url: string): string {
  const buffer = base64UrlToBuffer(base64Url);
  return bufferToUtf8(buffer);
}
