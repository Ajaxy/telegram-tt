let scrollLockEl: HTMLElement | null | undefined;

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

const getTouchY = (e: WheelEvent | TouchEvent) => ('changedTouches' in e ? e.changedTouches[0].clientY : 0);

const preventDefault = (e: WheelEvent | TouchEvent) => {
  const deltaY = 'deltaY' in e ? e.deltaY : getTouchY(e);

  if (
    !scrollLockEl
    // Allow overlay scrolling
    || !scrollLockEl.contains(e.target as HTMLElement)
    // Prevent top overscroll
    || (scrollLockEl.scrollTop <= 0 && deltaY <= 0)
    // Prevent bottom overscroll
    || (scrollLockEl.scrollTop >= (scrollLockEl.scrollHeight - scrollLockEl.offsetHeight) && deltaY >= 0)
  ) {
    e.preventDefault();
  }
};

function preventDefaultForScrollKeys(e: KeyboardEvent) {
  if (IGNORED_KEYS[e.key] && !isTextBox(e.target)) {
    e.preventDefault();
  }
}

export function disableScrolling(el?: HTMLElement | null) {
  scrollLockEl = el;
  // Disable scrolling in Chrome
  document.addEventListener('wheel', preventDefault, { passive: false });
  document.addEventListener('touchmove', preventDefault, { passive: false });
  document.onkeydown = preventDefaultForScrollKeys;
}

export function enableScrolling() {
  scrollLockEl = undefined;
  document.removeEventListener('wheel', preventDefault); // Enable scrolling in Chrome
  document.removeEventListener('touchmove', preventDefault);
  // eslint-disable-next-line no-null/no-null
  document.onkeydown = null;
}
