import type {
  KeyboardShortcutSettings,
  ResolvedKeyboardShortcutCombo,
} from '../../../../util/keyboardShortcuts';
import type {
  KeyboardShortcutCondition,
  KeyboardShortcutId,
  KeyboardShortcutScope,
} from '../../../../util/keyboardShortcuts/registry';
import type { LangFn } from '../../../../util/localization';

import { IS_APP } from '../../../../util/browser/windowEnvironment';
import { unique } from '../../../../util/iteratees';
import { getKeyboardShortcutCombos } from '../../../../util/keyboardShortcuts';
import {
  getIsFunctionKey,
  IS_APPLE_KEYBOARD,
  MOD_MODIFIER,
  normalizeKeyCombo,
  parseKeyCombo,
} from '../../../../util/keyboardShortcuts/keyCombos';
import {
  KEYBOARD_SHORTCUT_IDS,
  KEYBOARD_SHORTCUT_SECTIONS,
  KEYBOARD_SHORTCUTS,
  TEXT_EDITING_COMBOS,
} from '../../../../util/keyboardShortcuts/registry';
import { splitWords } from '../search/searchSettings';

type KeyboardShortcutCombos = Record<KeyboardShortcutId, ResolvedKeyboardShortcutCombo[]>;

export type RecordedComboCheck =
  { type: 'ok' }
  | { type: 'needsModifier' }
  | { type: 'reserved' }
  | { type: 'usedByFixed'; ownerId: KeyboardShortcutId }
  | { type: 'usedByEditable'; ownerIds: KeyboardShortcutId[] };

const MAIN_SCOPES = new Set<KeyboardShortcutScope>(['chatList', 'chat', 'composer', 'messageSelection']);
const EXCLUSIVE_CONDITIONS: [KeyboardShortcutCondition, KeyboardShortcutCondition][] = [
  ['hasSelection', 'noSelection'],
  ['hasSelection', 'isInputEmpty'],
];

const COMMAND_MODIFIERS = new Set(['Ctrl', 'Alt', 'Meta']);
const RESERVED_KEYS = new Set(['Enter', 'Tab']);
const RESERVED_KEYS_WITH_MODIFIERS = new Set(['Backspace', 'Delete', 'Escape']);
const SYSTEM_RESERVED_COMBOS = [
  ...TEXT_EDITING_COMBOS,
  ...(IS_APPLE_KEYBOARD ? ['Meta+Q'] : []),
];
const BROWSER_RESERVED_COMBOS = [
  'Mod+N', 'Mod+Shift+N', 'Mod+T', 'Mod+Shift+T', 'Mod+W', 'Mod+Shift+W', 'Ctrl+PageUp', 'Ctrl+PageDown', 'F11',
  ...(IS_APPLE_KEYBOARD ? ['Meta+Alt+ArrowLeft', 'Meta+Alt+ArrowRight', 'Meta+Shift+[', 'Meta+Shift+]'] : ['Ctrl+F4']),
];
const RESERVED_COMBOS = new Set([
  ...SYSTEM_RESERVED_COMBOS,
  ...(IS_APP ? [] : BROWSER_RESERVED_COMBOS),
].map(normalizeKeyCombo));

const KEY_QUERY_ALIASES: Record<string, string> = {
  cmd: 'Meta',
  command: 'Meta',
  meta: 'Meta',
  win: 'Meta',
  '⌘': 'Meta',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  '⌃': 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  '⌥': 'Alt',
  shift: 'Shift',
  '⇧': 'Shift',
  mod: MOD_MODIFIER,
  enter: 'Enter',
  return: 'Enter',
  '↵': 'Enter',
  esc: 'Escape',
  escape: 'Escape',
  tab: 'Tab',
  space: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  up: 'ArrowUp',
  '↑': 'ArrowUp',
  down: 'ArrowDown',
  '↓': 'ArrowDown',
  left: 'ArrowLeft',
  '←': 'ArrowLeft',
  right: 'ArrowRight',
  '→': 'ArrowRight',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End',
};
const RE_KEY_SYMBOL = /([⌘⌃⌥⇧↵↑↓←→])/g;
const RE_KEY_SEPARATOR = /[\s+]+/;
const RE_WORD_DASH = /(\w)-(?=\w)/g;

const CONDITION_TITLE_KEYS = {
  hasSelection: 'ShortcutWhenSelection',
  noSelection: 'ShortcutWhenNoSelection',
  isInputEmpty: 'ShortcutWhenInputEmpty',
} as const;

export function buildKeyboardShortcutCombos(settings: KeyboardShortcutSettings) {
  return KEYBOARD_SHORTCUT_IDS.reduce((result, id) => {
    result[id] = getKeyboardShortcutCombos(id, settings);
    return result;
  }, {} as KeyboardShortcutCombos);
}

export function buildKeyboardShortcutConflicts(combos: KeyboardShortcutCombos) {
  const entriesByCombo = new Map<string, { id: KeyboardShortcutId; condition?: KeyboardShortcutCondition }[]>();
  KEYBOARD_SHORTCUT_IDS.forEach((id) => {
    combos[id].forEach(({ combo, condition }) => {
      const entries = entriesByCombo.get(combo);
      if (entries) {
        entries.push({ id, condition });
      } else {
        entriesByCombo.set(combo, [{ id, condition }]);
      }
    });
  });

  const conflicts: Partial<Record<KeyboardShortcutId, KeyboardShortcutId[]>> = {};
  entriesByCombo.forEach((entries) => {
    entries.forEach((entry, index) => {
      entries.slice(index + 1).forEach((other) => {
        if (entry.id === other.id || !getIsConflict(entry.id, entry.condition, other.id, other.condition)) return;

        addConflict(conflicts, entry.id, other.id);
        addConflict(conflicts, other.id, entry.id);
      });
    });
  });

  return conflicts;
}

export function checkRecordedCombo(
  id: KeyboardShortcutId, { combo, condition }: ResolvedKeyboardShortcutCombo, combos: KeyboardShortcutCombos,
): RecordedComboCheck {
  const { modifiers, key } = parseKeyCombo(combo);
  const hasCommandModifier = modifiers.some((modifier) => COMMAND_MODIFIERS.has(modifier));

  if (getIsReservedCombo(combo, key, modifiers.length > 0)) return { type: 'reserved' };
  if (!hasCommandModifier && !getIsFunctionKey(key)) return { type: 'needsModifier' };

  const ownerIds = findComboOwners(id, combo, condition, combos);
  if (!ownerIds.length) return { type: 'ok' };

  const fixedOwnerId = ownerIds.find((ownerId) => !KEYBOARD_SHORTCUTS[ownerId].isEditable);

  return fixedOwnerId ? { type: 'usedByFixed', ownerId: fixedOwnerId } : { type: 'usedByEditable', ownerIds };
}

export function findEditableDefaultComboOwners(
  id: KeyboardShortcutId, defaultCombos: ResolvedKeyboardShortcutCombo[], combos: KeyboardShortcutCombos,
) {
  const ownerIds = defaultCombos.flatMap(({ combo, condition }) => findComboOwners(id, combo, condition, combos));

  return unique(ownerIds).filter((ownerId) => KEYBOARD_SHORTCUTS[ownerId].isEditable);
}

export function filterKeyboardShortcuts(query: string, combos: KeyboardShortcutCombos, lang: LangFn) {
  const queryWords = splitWords(query);
  const queryKeys = parseKeyQuery(query);
  if (!queryWords.length && !queryKeys?.length) return KEYBOARD_SHORTCUT_IDS;

  const sectionTitles = KEYBOARD_SHORTCUT_SECTIONS.reduce((result, { section, titleKey }) => {
    result[section] = lang(titleKey);
    return result;
  }, {} as Record<string, string>);

  return KEYBOARD_SHORTCUT_IDS.filter((id) => {
    const { titleKey, descriptionKey, section, condition } = KEYBOARD_SHORTCUTS[id];
    if (queryKeys && getHasComboWithKeys(combos[id], queryKeys)) return true;
    if (!queryWords.length) return false;

    const words = splitWords([
      lang(titleKey),
      sectionTitles[section],
      descriptionKey ? lang(descriptionKey) : '',
      condition ? lang(CONDITION_TITLE_KEYS[condition]) : '',
      ...combos[id].map((resolved) => (resolved.condition ? lang(CONDITION_TITLE_KEYS[resolved.condition]) : '')),
    ].join(' '));

    return queryWords.every((queryWord) => words.some((word) => word.startsWith(queryWord)));
  });
}

export function getConditionTitleKey(condition: KeyboardShortcutCondition) {
  return CONDITION_TITLE_KEYS[condition];
}

function getIsConflict(
  id: KeyboardShortcutId,
  condition: KeyboardShortcutCondition | undefined,
  otherId: KeyboardShortcutId,
  otherCondition: KeyboardShortcutCondition | undefined,
) {
  const shortcut = KEYBOARD_SHORTCUTS[id];
  const other = KEYBOARD_SHORTCUTS[otherId];

  return Boolean(shortcut.isEditable || other.isEditable)
    && getAreScopesOverlapping(shortcut.scope, other.scope)
    && !getAreConditionsExclusive(condition, otherCondition);
}

function getAreScopesOverlapping(scope: KeyboardShortcutScope, otherScope: KeyboardShortcutScope) {
  if (scope === otherScope || scope === 'global' || otherScope === 'global') return true;
  if (!MAIN_SCOPES.has(scope) || !MAIN_SCOPES.has(otherScope)) return false;

  const scopes = [scope, otherScope];
  return !(scopes.includes('composer') && scopes.includes('messageSelection'));
}

function getAreConditionsExclusive(condition?: KeyboardShortcutCondition, otherCondition?: KeyboardShortcutCondition) {
  if (!condition || !otherCondition) return false;

  return EXCLUSIVE_CONDITIONS.some(([first, second]) => (
    (condition === first && otherCondition === second) || (condition === second && otherCondition === first)
  ));
}

function findComboOwners(
  id: KeyboardShortcutId,
  combo: string,
  condition: KeyboardShortcutCondition | undefined,
  combos: KeyboardShortcutCombos,
) {
  return KEYBOARD_SHORTCUT_IDS.filter((otherId) => (
    otherId !== id && combos[otherId].some((resolved) => (
      resolved.combo === combo && getIsConflict(id, condition, otherId, resolved.condition)
    ))
  ));
}

function addConflict(
  conflicts: Partial<Record<KeyboardShortcutId, KeyboardShortcutId[]>>,
  id: KeyboardShortcutId,
  otherId: KeyboardShortcutId,
) {
  const ids = conflicts[id];
  if (!ids) {
    conflicts[id] = [otherId];
  } else if (!ids.includes(otherId)) {
    ids.push(otherId);
  }
}

function getIsReservedCombo(combo: string, key: string, hasModifiers: boolean) {
  return RESERVED_COMBOS.has(combo)
    || RESERVED_KEYS.has(key)
    || (hasModifiers && RESERVED_KEYS_WITH_MODIFIERS.has(key));
}

function parseKeyQuery(query: string) {
  const tokens = query.toLowerCase()
    .replace(RE_KEY_SYMBOL, ' $1 ')
    .replace(RE_WORD_DASH, '$1 ')
    .split(RE_KEY_SEPARATOR)
    .filter(Boolean);
  if (!tokens.length) return undefined;

  const keys = tokens.map((token) => (
    KEY_QUERY_ALIASES[token] || (token.length === 1 || getIsFunctionKey(token.toUpperCase()) ? token : undefined)
  ));

  return keys.every(Boolean) ? keys as string[] : undefined;
}

function getHasComboWithKeys(combos: ResolvedKeyboardShortcutCombo[], keys: string[]) {
  return combos.some(({ combo }) => {
    const { modifiers, key } = parseKeyCombo(combo);
    const parts = [...modifiers, key].map((part) => part.toLowerCase());

    return keys.every((queryKey) => parts.includes(queryKey.toLowerCase()));
  });
}
