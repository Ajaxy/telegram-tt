export default function getFooterOverlayHeight(container: HTMLElement) {
  return parseInt(getComputedStyle(container).getPropertyValue('--middle-column-footer-height'), 10) || 0;
}
