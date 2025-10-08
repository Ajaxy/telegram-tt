export default function focusNoScroll(element?: HTMLElement) {
  if (!element) return;

  element.focus({ preventScroll: true });
}
