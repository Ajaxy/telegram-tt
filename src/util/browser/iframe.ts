import type { BotAppPermissions } from '../../types';
import type { WebAppMediaKind } from '../../types/webapp';

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
const WEB_APP_ALLOW_ATTRIBUTES = [
  'clipboard-write',
  'web-share',
  'screen-wake-lock',
  'autoplay',
  'encrypted-media',
  'picture-in-picture',
  'storage-access',
  'publickey-credentials-get',
  'publickey-credentials-create',
  'identity-credentials-get',
].map((feature) => `${feature};`).join(' ');
export const WEB_APP_MEDIA_KINDS: WebAppMediaKind[] = ['camera', 'microphone'];

export function isMessageFromIframe(event: MessageEvent, iframe?: HTMLIFrameElement, expectedOrigin?: string) {
  return Boolean(
    iframe?.contentWindow
    && event.source === iframe.contentWindow
    && (expectedOrigin === undefined || event.origin === expectedOrigin),
  );
}

export function buildWebAppAllowAttribute(permissions?: BotAppPermissions, origin?: string) {
  // Without an origin, the browser delegates the feature to the origin of the `src` URL
  const allowlist = origin ? ` ${origin}` : '';
  const mediaFeatures = WEB_APP_MEDIA_KINDS
    .filter((kind) => permissions?.[kind])
    .map((kind) => `${kind}${allowlist};`);

  return [WEB_APP_ALLOW_ATTRIBUTES, ...mediaFeatures].join(' ');
}

export function getWebAppOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch (err) {
    return undefined;
  }
}
