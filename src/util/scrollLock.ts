const IGNORED_KEYS: Record<string, boolean> = {
  Down: true,
  ArrowDown: true,
  Up: true,
  ArrowUp: true,
  Left: true,
  ArrowLeft: true,
  Right: true,
  ArrowRight: true,
  ' ': true,
  PageUp: true,
  PageDown: true,
  End: true,
  Home: true,
  Tab: true,
};

function isTextBox(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const element = target;
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'textarea') return true;
  if (tagName !== 'input') return false;
  const type = element.getAttribute('type');
  if (!type) return false;
  const inputTypes = [
    'text', 'password', 'number', 'email', 'tel', 'url',
    'search', 'date', 'datetime', 'datetime-local', 'time', 'month', 'week',
  ];
  return inputTypes.indexOf(type.toLowerCase()) > -1;
}

const preventDefault = (e: Event) => {
  e.preventDefault();
};

function preventDefaultForScrollKeys(e: KeyboardEvent) {
  if (IGNORED_KEYS[e.key] && !isTextBox(e.target)) {
    preventDefault(e);
  }
}

export function disableScrolling() {
  // Disable scrolling in Chrome
  document.addEventListener('wheel', preventDefault, { passive: false });
  window.ontouchmove = preventDefault; // mobile
  document.onkeydown = preventDefaultForScrollKeys;
}

export function enableScrolling() {
  document.removeEventListener('wheel', preventDefault); // Enable scrolling in Chrome
  // eslint-disable-next-line no-null/no-null
  window.ontouchmove = null;
  // eslint-disable-next-line no-null/no-null
  document.onkeydown = null;
}
