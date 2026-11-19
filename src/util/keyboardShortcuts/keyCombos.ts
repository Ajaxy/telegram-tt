import type { LangFn } from '../localization';

import { IS_IOS, IS_MAC_OS } from '../browser/windowEnvironment';

export type KeyComboModifier = 'Ctrl' | 'Alt' | 'Shift' | 'Meta';

export const IS_APPLE_KEYBOARD = IS_MAC_OS || IS_IOS;

const MODIFIERS: KeyComboModifier[] = ['Ctrl', 'Alt', 'Shift', 'Meta'];
export const MOD_MODIFIER: KeyComboModifier = IS_APPLE_KEYBOARD ? 'Meta' : 'Ctrl';
const COMBO_SEPARATOR = '+';
const LABEL_SEPARATOR = IS_APPLE_KEYBOARD ? '' : '+';

const MODIFIER_EVENT_KEYS = new Set(['Control', 'Alt', 'AltGraph', 'Shift', 'Meta', 'OS', 'Fn', 'CapsLock']);
const NAMED_KEYS = new Set([
  'Enter', 'Escape', 'Backspace', 'Delete', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
]);
const KEY_BY_CODE: Record<string, string> = {
  Space: 'Space',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: '\'',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
};
const PUNCTUATION_KEYS = new Set(Object.values(KEY_BY_CODE));
const RE_LATIN_LETTER = /^[a-z]$/i;
const RE_FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

const MAC_MODIFIER_LABELS: Record<KeyComboModifier, string> = {
  Ctrl: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Meta: '⌘',
};
const OTHER_MODIFIER_LABELS: Record<KeyComboModifier, string> = {
  Ctrl: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Meta: 'Win',
};
const ARROW_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};
const MAC_KEY_LABELS: Record<string, string> = {
  Enter: '↵',
  Backspace: '⌫',
  Delete: '⌦',
  Tab: '⇥',
};

export function getKeyComboFromEvent(e: KeyboardEvent | React.KeyboardEvent) {
  if (MODIFIER_EVENT_KEYS.has(e.key) || getIsAltGraphCharacter(e)) return undefined;

  const key = getKeyFromEvent(e);
  if (!key) return undefined;

  return buildKeyCombo(getEventModifiers(e), key);
}

export function getEventModifiers(e: KeyboardEvent | React.KeyboardEvent) {
  const isAltGraph = getIsAltGraph(e);

  return MODIFIERS.filter((modifier) => (
    (modifier === 'Ctrl' && (e.ctrlKey || isAltGraph))
    || (modifier === 'Alt' && (e.altKey || isAltGraph))
    || (modifier === 'Shift' && e.shiftKey)
    || (modifier === 'Meta' && e.metaKey)
  ));
}

export function normalizeKeyCombo(combo: string) {
  const { modifiers, key } = parseKeyCombo(combo);
  return buildKeyCombo(modifiers, key.length === 1 ? key.toLowerCase() : key);
}

export function parseKeyCombo(combo: string) {
  const parts = combo.split(COMBO_SEPARATOR);
  const key = parts.pop()!;
  const modifiers = parts.map((part) => (part === 'Mod' ? MOD_MODIFIER : part as KeyComboModifier));

  return { modifiers, key };
}

export function getKeyComboLabels(combo: string, lang: LangFn) {
  const { modifiers, key } = parseKeyCombo(combo);

  return [...getModifierLabels(modifiers), getKeyLabel(key, lang)];
}

export function getKeyComboText(combo: string, lang: LangFn) {
  return getKeyComboLabels(combo, lang).join(LABEL_SEPARATOR);
}

export function getModifierLabels(modifiers: (KeyComboModifier | 'Mod')[]) {
  const labels = IS_APPLE_KEYBOARD ? MAC_MODIFIER_LABELS : OTHER_MODIFIER_LABELS;
  const resolved = modifiers.map((modifier) => (modifier === 'Mod' ? MOD_MODIFIER : modifier));

  return MODIFIERS.filter((modifier) => resolved.includes(modifier)).map((modifier) => labels[modifier]);
}

export function getKeyLabel(key: string, lang: LangFn) {
  if (ARROW_LABELS[key]) return ARROW_LABELS[key];
  if (IS_APPLE_KEYBOARD && MAC_KEY_LABELS[key]) return MAC_KEY_LABELS[key];

  switch (key) {
    case 'Space':
      return lang('KeyboardKeySpace');
    case 'Enter':
      return lang('KeyboardKeyEnter');
    case 'Escape':
      return lang('KeyboardKeyEsc');
    case 'Backspace':
      return lang('KeyboardKeyBackspace');
    case 'Delete':
      return lang('KeyboardKeyDelete');
    case 'Tab':
      return lang('KeyboardKeyTab');
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

export function getIsFunctionKey(key: string) {
  return RE_FUNCTION_KEY.test(key);
}

function buildKeyCombo(modifiers: KeyComboModifier[], key: string) {
  return [...MODIFIERS.filter((modifier) => modifiers.includes(modifier)), key].join(COMBO_SEPARATOR);
}

function getKeyFromEvent(e: KeyboardEvent | React.KeyboardEvent) {
  const { code, key } = e;

  if (RE_LATIN_LETTER.test(key)) return key.toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (PUNCTUATION_KEYS.has(key)) return key;
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (KEY_BY_CODE[code]) return KEY_BY_CODE[code];
  if (NAMED_KEYS.has(key) || RE_FUNCTION_KEY.test(key)) return key;

  return undefined;
}

function getIsAltGraphCharacter(e: KeyboardEvent | React.KeyboardEvent) {
  return getIsAltGraph(e) && !NAMED_KEYS.has(e.key) && !getIsFunctionKey(e.key) && !RE_LATIN_LETTER.test(e.key);
}

function getIsAltGraph(e: KeyboardEvent | React.KeyboardEvent) {
  return !IS_APPLE_KEYBOARD && e.getModifierState('AltGraph');
}
