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

const preventDefault = (e: Event) => {
  e.preventDefault();
};

function preventDefaultForScrollKeys(e: KeyboardEvent) {
  if (IGNORED_KEYS[e.key]) {
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
