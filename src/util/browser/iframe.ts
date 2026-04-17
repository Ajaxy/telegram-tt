export function isMessageFromIframe(event: MessageEvent, iframe?: HTMLIFrameElement) {
  return Boolean(iframe?.contentWindow && event.source === iframe.contentWindow);
}
