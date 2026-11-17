import { createSignal } from './signals';

const MODIFIER_FLAGS = {
  Alt: 'altKey',
  Control: 'ctrlKey',
  Meta: 'metaKey',
  Shift: 'shiftKey',
} as const;

// `KeyboardEvent.code` -> `KeyboardEvent.key` at the moment of press.
// Keyed by code, since `key` may differ between keydown and keyup (e.g. `a` -> `A` with Shift, `å` with Option)
const [getPressedKeys, setPressedKeys] = createSignal<ReadonlyMap<string, string>>(new Map());

export { getPressedKeys };

/**
 * @param keyOrCode `KeyboardEvent.key` (`Alt`, `Shift`, `a`) or `KeyboardEvent.code` (`AltLeft`, `KeyA`)
 */
export function isKeyPressed(keyOrCode: string) {
  const pressedKeys = getPressedKeys();
  if (pressedKeys.has(keyOrCode)) return true;

  for (const key of pressedKeys.values()) {
    if (key === keyOrCode) return true;
  }

  return false;
}

function update(e: KeyboardEvent | MouseEvent, change?: (keys: Map<string, string>) => void) {
  const current = getPressedKeys();
  const next = new Map(current);
  change?.(next);

  // Mouse events and keys pressed outside the window carry modifier state too, so resync from event flags
  Object.entries(MODIFIER_FLAGS).forEach(([modifier, flag]) => {
    const isPressed = e[flag];
    const entries = [...next].filter(([, key]) => key === modifier);
    if (isPressed && !entries.length) {
      next.set(modifier, modifier);
    } else if (!isPressed) {
      entries.forEach(([code]) => next.delete(code));
    }
  });

  const hasChanged = next.size !== current.size || [...next].some(([code, key]) => current.get(code) !== key);
  if (hasChanged) {
    setPressedKeys(next);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  update(e, (keys) => {
    keys.set(e.code || e.key, e.key);
  });
}

function handleKeyUp(e: KeyboardEvent) {
  update(e, (keys) => {
    // macOS does not fire `keyup` for other keys while Meta is held
    if (e.key === 'Meta') keys.clear();
    keys.delete(e.code || e.key);
  });
}

function handleBlur() {
  if (getPressedKeys().size) {
    setPressedKeys(new Map());
  }
}

window.addEventListener('keydown', handleKeyDown, true);
window.addEventListener('keyup', handleKeyUp, true);
window.addEventListener('pointerdown', update, true);
window.addEventListener('contextmenu', update, true);
window.addEventListener('blur', handleBlur);
