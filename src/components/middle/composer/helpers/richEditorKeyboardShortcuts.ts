import { type Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { getGlobal } from '../../../../global';

import type { KeyboardShortcutSettings, ResolvedKeyboardShortcutCombo } from '../../../../util/keyboardShortcuts';
import type { KeyboardShortcutId } from '../../../../util/keyboardShortcuts/registry';

import { selectSharedSettings } from '../../../../global/selectors/sharedState';
import {
  getDefaultKeyboardShortcutCombos,
  getIsKeyboardShortcutHandled,
  getKeyboardShortcutCombos,
  markKeyboardShortcutHandled,
} from '../../../../util/keyboardShortcuts';
import { getKeyComboFromEvent, normalizeKeyCombo } from '../../../../util/keyboardShortcuts/keyCombos';
import { DROPPED_EDITOR_COMBOS, KEYBOARD_SHORTCUT_IDS } from '../../../../util/keyboardShortcuts/registry';
import { clearRichEditorFormatting } from '../../../ui/textInput/richEditorFormatting';

import { openRichEditorFormatterControl } from '../../../common/tooltips/extensions/RichEditorTooltips';

type EditorCommand = {
  markName?: string;
  run: (editor: Editor) => boolean;
};

const EDITOR_COMMANDS: Partial<Record<KeyboardShortcutId, EditorCommand>> = {
  bold: { markName: 'bold', run: (editor) => editor.commands.toggleBold() },
  italic: { markName: 'italic', run: (editor) => editor.commands.toggleItalic() },
  underline: { markName: 'underline', run: (editor) => editor.commands.toggleUnderline() },
  strikethrough: { markName: 'strike', run: (editor) => editor.commands.toggleStrike() },
  monospace: { markName: 'code', run: toggleRichEditorCode },
  spoiler: { markName: 'spoiler', run: (editor) => editor.commands.toggleMark('spoiler') },
  link: { run: (editor) => openRichEditorFormatterControl(editor, 'link') },
  date: { run: (editor) => openRichEditorFormatterControl(editor, 'date') },
  blockquote: { run: (editor) => editor.commands.toggleBlockquote() },
  clearFormatting: { run: clearRichEditorFormatting },
  subscript: { markName: 'subscript', run: (editor) => editor.commands.toggleSubscript() },
  superscript: { markName: 'superscript', run: (editor) => editor.commands.toggleSuperscript() },
  paragraph: { run: (editor) => editor.commands.setParagraph() },
  codeBlock: { run: (editor) => editor.commands.toggleCodeBlock() },
  bulletList: { run: (editor) => editor.commands.toggleBulletList() },
  orderedList: { run: (editor) => editor.commands.toggleOrderedList() },
};
const EDITOR_SHORTCUT_IDS = Object.keys(EDITOR_COMMANDS) as KeyboardShortcutId[];
const DEFAULT_EDITOR_COMBOS = buildDefaultEditorCombos();

const KEYBOARD_SHORTCUTS_KEY = new PluginKey('richEditorKeyboardShortcuts');
const KEYBOARD_SHORTCUTS_PRIORITY = 1000;

export const RichEditorKeyboardShortcuts = Extension.create({
  name: 'keyboardShortcuts',
  priority: KEYBOARD_SHORTCUTS_PRIORITY,

  addProseMirrorPlugins() {
    const { editor } = this;

    return [new Plugin({
      key: KEYBOARD_SHORTCUTS_KEY,
      props: {
        handleKeyDown: (view, e) => handleKeyDown(editor, e),
      },
    })];
  },
});

function handleKeyDown(editor: Editor, e: KeyboardEvent) {
  if (e.isComposing || !('getModifierState' in e)) return false;
  if (getIsKeyboardShortcutHandled(e)) return true;

  const combo = getKeyComboFromEvent(e);
  if (!combo) return false;

  const settings = selectSharedSettings(getGlobal());

  for (const id of EDITOR_SHORTCUT_IDS) {
    const resolved = getKeyboardShortcutCombos(id, settings).find((item) => item.combo === combo);
    if (!resolved) continue;

    const command = EDITOR_COMMANDS[id]!;
    if (getIsConditionMet(editor, resolved, settings, command) && command.run(editor)) {
      markKeyboardShortcutHandled(e);
      return true;
    }

    break;
  }

  const releasedDefault = DEFAULT_EDITOR_COMBOS.get(combo);

  return Boolean(releasedDefault && getIsConditionMet(editor, releasedDefault, settings, releasedDefault.command));
}

function getIsConditionMet(
  editor: Editor,
  resolved: ResolvedKeyboardShortcutCombo,
  settings: KeyboardShortcutSettings,
  command?: EditorCommand,
) {
  if (resolved.condition !== 'hasSelection' || !editor.state.selection.empty) return true;

  return Boolean(command?.markName && editor.isActive(command.markName))
    && !getIsNoSelectionCombo(resolved.combo, settings);
}

function getIsNoSelectionCombo(combo: string, settings: KeyboardShortcutSettings) {
  return KEYBOARD_SHORTCUT_IDS.some((id) => getKeyboardShortcutCombos(id, settings).some((resolved) => (
    resolved.combo === combo && resolved.condition === 'noSelection'
  )));
}

function buildDefaultEditorCombos() {
  const result = new Map<string, ResolvedKeyboardShortcutCombo & { command?: EditorCommand }>();

  EDITOR_SHORTCUT_IDS.forEach((id) => {
    getDefaultKeyboardShortcutCombos(id, 'enter').forEach((resolved) => {
      result.set(resolved.combo, { ...resolved, command: EDITOR_COMMANDS[id] });
    });
  });

  DROPPED_EDITOR_COMBOS.forEach((combo) => {
    result.set(normalizeKeyCombo(combo), { combo: normalizeKeyCombo(combo) });
  });

  return result;
}

function toggleRichEditorCode(editor: Editor) {
  return editor.state.selection.empty
    ? editor.commands.toggleCode()
    : editor.commands.toggleSelectionCode();
}
