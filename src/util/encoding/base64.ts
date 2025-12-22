export function base64UrlToBase64(base64Url: string): string {
  const base64Encoded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64Url.length % 4 === 0 ? '' : '='.repeat(4 - (base64Url.length % 4));
  const base64WithPadding = base64Encoded + padding;
  return base64WithPadding;
}

export function base64UrlToBuffer(base64Url: string): Buffer<ArrayBuffer> {
  const base64 = base64UrlToBase64(base64Url);
  return Buffer.from(base64, 'base64');
}

export function base64UrlToString(base64Url: string): string {
  const buffer = base64UrlToBuffer(base64Url);
  return buffer.toString('utf-8');
}
