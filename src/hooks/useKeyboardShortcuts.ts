import { useEffect } from '../lib/teact/teact';
import { getGlobal } from '../global';

import type { KeyboardShortcutId } from '../util/keyboardShortcuts/registry';

import { selectSharedSettings } from '../global/selectors/sharedState';
import { createCallbackManager } from '../util/callbacks';
import { getIsKeyboardShortcutHandled, getKeyboardShortcutCombos } from '../util/keyboardShortcuts';
import { getKeyComboFromEvent, normalizeKeyCombo, parseKeyCombo } from '../util/keyboardShortcuts/keyCombos';
import { TEXT_EDITING_COMBOS } from '../util/keyboardShortcuts/registry';

type KeyboardShortcutHandler = (e: KeyboardEvent) => void | boolean;
type KeyboardShortcutHandlers = Partial<Record<KeyboardShortcutId, KeyboardShortcutHandler>>;

const TEXT_FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const TEXT_FIELD_MODIFIERS = new Set(['Ctrl', 'Meta']);
const CARET_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);
const TEXT_EDITING_COMBO_SET = new Set(TEXT_EDITING_COMBOS.map(normalizeKeyCombo));

const handlers = createCallbackManager();
document.documentElement.addEventListener('keydown', handlers.runCallbacks);

export default function useKeyboardShortcuts(shortcutHandlers?: KeyboardShortcutHandlers) {
  useEffect(() => {
    if (!shortcutHandlers) {
      return undefined;
    }

    const entries = Object.entries(shortcutHandlers) as [KeyboardShortcutId, KeyboardShortcutHandler][];

    function handleKeyDown(e: KeyboardEvent) {
      const combo = getKeyComboFromEvent(e);
      if (!combo || !shouldHandleEvent(e, combo)) return;

      const settings = selectSharedSettings(getGlobal());
      entries.forEach(([id, handler]) => {
        if (!getKeyboardShortcutCombos(id, settings).some((resolved) => resolved.combo === combo)) return;

        if (handler(e) !== false) e.preventDefault();
      });
    }

    return handlers.addCallback(handleKeyDown);
  }, [shortcutHandlers]);
}

function shouldHandleEvent(e: KeyboardEvent, combo: string) {
  if (getIsKeyboardShortcutHandled(e)) return false;
  if (!(e.target instanceof HTMLElement) || !TEXT_FIELD_TAGS.has(e.target.tagName)) return true;

  const { modifiers, key } = parseKeyCombo(combo);

  return modifiers.some((modifier) => TEXT_FIELD_MODIFIERS.has(modifier))
    && !CARET_KEYS.has(key)
    && !TEXT_EDITING_COMBO_SET.has(combo);
}
