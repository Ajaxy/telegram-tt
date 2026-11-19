import { getGlobal } from '../../global';

import type { SharedSettings } from '../../global/types';
import type { KeyboardShortcutCondition, KeyboardShortcutDefault, KeyboardShortcutId } from './registry';

import { selectSharedSettings } from '../../global/selectors/sharedState';
import { IS_APP, IS_FIREFOX, IS_WINDOWS } from '../browser/windowEnvironment';
import { getKeyComboFromEvent, IS_APPLE_KEYBOARD, normalizeKeyCombo } from './keyCombos';
import { KEYBOARD_SHORTCUT_IDS, KEYBOARD_SHORTCUTS } from './registry';

export type KeyboardShortcutSettings = Pick<SharedSettings, 'keyboardShortcuts' | 'messageSendKeyCombo'>;

export type ResolvedKeyboardShortcutCombo = {
  combo: string;
  condition?: KeyboardShortcutCondition;
};

type SendKeyCombo = SharedSettings['messageSendKeyCombo'];

const NO_COMBOS: ResolvedKeyboardShortcutCombo[] = [];
const DEFAULT_COMBOS: Record<SendKeyCombo, Record<KeyboardShortcutId, ResolvedKeyboardShortcutCombo[]>> = {
  enter: buildDefaultCombos('enter'),
  'ctrl-enter': buildDefaultCombos('ctrl-enter'),
};

const handledEvents = new WeakSet<object>();

export function getKeyboardShortcutCombos(id: KeyboardShortcutId, settings: KeyboardShortcutSettings) {
  const custom = settings.keyboardShortcuts?.[id];
  if (custom === false) return NO_COMBOS;

  const defaults = getDefaultKeyboardShortcutCombos(id, settings.messageSendKeyCombo);
  if (!custom) return defaults;

  const matchingDefault = defaults.find(({ combo }) => combo === custom);

  return [matchingDefault ?? { combo: custom, condition: KEYBOARD_SHORTCUTS[id].condition }];
}

export function getDefaultKeyboardShortcutCombos(id: KeyboardShortcutId, sendKeyCombo: SendKeyCombo) {
  return DEFAULT_COMBOS[sendKeyCombo][id];
}

export function getIsKeyboardShortcutAvailable(id: KeyboardShortcutId) {
  return KEYBOARD_SHORTCUTS[id].isEditable || DEFAULT_COMBOS.enter[id].length > 0;
}

export function getIsKeyboardShortcut(e: KeyboardEvent | React.KeyboardEvent, id: KeyboardShortcutId) {
  const combo = getKeyComboFromEvent(e);
  if (!combo) return false;

  return getKeyboardShortcutCombos(id, selectSharedSettings(getGlobal()))
    .some((resolved) => resolved.combo === combo);
}

export function markKeyboardShortcutHandled(e: Event | React.SyntheticEvent) {
  handledEvents.add(e);
}

export function getIsKeyboardShortcutHandled(e: Event) {
  return handledEvents.has(e);
}

function buildDefaultCombos(sendKeyCombo: SendKeyCombo) {
  return KEYBOARD_SHORTCUT_IDS.reduce((result, id) => {
    const { defaults, condition } = KEYBOARD_SHORTCUTS[id];
    result[id] = defaults
      .filter((shortcutDefault) => getIsDefaultAvailable(shortcutDefault, sendKeyCombo))
      .map((shortcutDefault) => ({
        combo: normalizeKeyCombo(shortcutDefault.combo),
        condition: shortcutDefault.condition ?? condition,
      }));
    return result;
  }, {} as Record<KeyboardShortcutId, ResolvedKeyboardShortcutCombo[]>);
}

function getIsDefaultAvailable(shortcutDefault: KeyboardShortcutDefault, sendKeyCombo: SendKeyCombo) {
  const { platform, environment } = shortcutDefault;

  if (platform === 'mac' && !IS_APPLE_KEYBOARD) return false;
  if (platform === 'windows' && !IS_WINDOWS) return false;
  if (environment === 'app' && !IS_APP) return false;
  if (environment === 'notMacApp' && IS_APPLE_KEYBOARD && IS_APP) return false;
  if (environment === 'notFirefox' && IS_FIREFOX) return false;
  if (shortcutDefault.sendKeyCombo && shortcutDefault.sendKeyCombo !== sendKeyCombo) return false;

  return true;
}
