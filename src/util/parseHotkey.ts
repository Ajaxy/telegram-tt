// Original source from Mantine
// https://github.com/mantinedev/mantine/blob/master/src/mantine-hooks/src/use-hotkeys/parse-hotkey.ts

export type KeyboardModifiers = {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  mod: boolean;
  shift: boolean;
};

export type Hotkey = KeyboardModifiers & {
  key?: string;
};

type CheckHotkeyMatch = (event: KeyboardEvent) => boolean;

export function parseHotkey(hotkey: string): Hotkey {
  const keys = hotkey
    .toLowerCase()
    .split('+')
    .map((part) => part.trim());

  const modifiers: KeyboardModifiers = {
    alt: keys.includes('alt'),
    ctrl: keys.includes('ctrl'),
    meta: keys.includes('meta'),
    mod: keys.includes('mod'),
    shift: keys.includes('shift'),
  };

  const reservedKeys = ['alt', 'ctrl', 'meta', 'shift', 'mod'];

  const freeKey = keys.find((key) => !reservedKeys.includes(key));

  return {
    ...modifiers,
    key: freeKey,
  };
}

function isExactHotkey(hotkey: Hotkey, event: KeyboardEvent): boolean {
  const {
    alt, ctrl, meta, mod, shift, key,
  } = hotkey;
  const {
    altKey, ctrlKey, metaKey, shiftKey, key: pressedKey,
  } = event;

  if (alt !== altKey) {
    return false;
  }

  if (mod) {
    if (!ctrlKey && !metaKey) {
      return false;
    }
  } else {
    if (ctrl !== ctrlKey) {
      return false;
    }
    if (meta !== metaKey) {
      return false;
    }
  }
  if (shift !== shiftKey) {
    return false;
  }

  return Boolean(key
    && (pressedKey.toLowerCase() === key.toLowerCase()
      || event.code.replace('Key', '').toLowerCase() === key.toLowerCase()));
}

export function getHotkeyMatcher(hotkey: string): CheckHotkeyMatch {
  return (event) => isExactHotkey(parseHotkey(hotkey), event);
}
