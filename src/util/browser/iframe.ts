export const IFRAME_SANDBOX_ATTRIBUTES = [
  'allow-scripts',
  'allow-popups',
  'allow-forms',
  'allow-modals',
  'allow-same-origin',
  'allow-storage-access-by-user-activation',
].join(' ');

export const EMBED_ALLOW_ATTRIBUTES = 'clipboard-write;';
export const IFRAME_ALLOW_ATTRIBUTES = 'camera; microphone; geolocation; clipboard-write;';

export function isMessageFromIframe(event: MessageEvent, iframe?: HTMLIFrameElement) {
  return Boolean(iframe?.contentWindow && event.source === iframe.contentWindow);
}
