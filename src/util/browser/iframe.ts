export const IFRAME_SANDBOX_ATTRIBUTES = [
  'allow-scripts',
  'allow-popups',
  'allow-forms',
  'allow-modals',
  'allow-same-origin',
  'allow-storage-access-by-user-activation',
].join(' ');

export const WEB_APP_SANDBOX_ATTRIBUTES = `${IFRAME_SANDBOX_ATTRIBUTES} allow-pointer-lock allow-orientation-lock`;

export const EMBED_ALLOW_ATTRIBUTES = 'clipboard-write;';
export const IFRAME_ALLOW_ATTRIBUTES = 'camera; microphone; geolocation; clipboard-write; web-share; screen-wake-lock;';

export function isMessageFromIframe(event: MessageEvent, iframe?: HTMLIFrameElement, expectedOrigin?: string) {
  return Boolean(
    iframe?.contentWindow
    && event.source === iframe.contentWindow
    && (expectedOrigin === undefined || event.origin === expectedOrigin),
  );
}
