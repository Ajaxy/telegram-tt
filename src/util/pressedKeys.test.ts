import { afterEach, describe, expect, it } from 'vitest';

import { getPressedKeys, isKeyPressed } from './pressedKeys';

function key(type: 'keydown' | 'keyup', init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent(type, init));
}

describe('pressedKeys', () => {
  afterEach(() => {
    window.dispatchEvent(new Event('blur'));
  });

  it('tracks keys by key and code, ignoring case change on release', () => {
    key('keydown', { key: 'a', code: 'KeyA' });
    expect(isKeyPressed('a')).toBe(true);
    expect(isKeyPressed('KeyA')).toBe(true);

    key('keyup', { key: 'A', code: 'KeyA' });
    expect(getPressedKeys().size).toBe(0);
  });

  it('keeps modifier pressed until both sides are released', () => {
    key('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    key('keydown', { key: 'Shift', code: 'ShiftRight', shiftKey: true });
    key('keyup', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    expect(isKeyPressed('Shift')).toBe(true);

    key('keyup', { key: 'Shift', code: 'ShiftRight' });
    expect(isKeyPressed('Shift')).toBe(false);
  });

  it('syncs modifiers from mouse events', () => {
    window.dispatchEvent(new MouseEvent('contextmenu', { altKey: true }));
    expect(isKeyPressed('Alt')).toBe(true);

    window.dispatchEvent(new MouseEvent('pointerdown'));
    expect(isKeyPressed('Alt')).toBe(false);
  });

  it('clears on window blur', () => {
    key('keydown', { key: 'Alt', code: 'AltLeft', altKey: true });
    window.dispatchEvent(new Event('blur'));
    expect(getPressedKeys().size).toBe(0);
  });
});
