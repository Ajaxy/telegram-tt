import type { ResolvedPos } from '@tiptap/pm/model';
import { PluginKey } from '@tiptap/pm/state';

import type {
  RichEditorTooltipSuggestion,
  RichEditorTooltipSurface,
} from '../../types';
import type { RichEditorTooltipsController } from './controller';

export const TOOLTIP_GAP_PX = 12;
export const SEARCH_DEBOUNCE_MS = 300;

export const PLUGIN_KEYS = {
  emoji: new PluginKey('richEditorEmojiSuggestion'),
  customEmoji: new PluginKey('richEditorCustomEmojiSuggestion'),
  mention: new PluginKey('richEditorMentionSuggestion'),
  sticker: new PluginKey('richEditorStickerSuggestion'),
  command: new PluginKey('richEditorCommandSuggestion'),
  inlineBot: new PluginKey('richEditorInlineBotSuggestion'),
};

export type GetTooltipController = () => RichEditorTooltipsController | undefined;

export function parseInlineBotQuery(text?: string) {
  const match = text?.match(/^@([a-z0-9_]{1,32})[\u00A0\u0020]+(.*)$/is);
  return match ? { username: match[1], query: match[2] } : undefined;
}

export function buildSuggestionRenderer(
  surface: RichEditorTooltipSurface,
  getController: GetTooltipController,
) {
  return {
    onStart: (props: RichEditorTooltipSuggestion) => getController()?.updateSuggestion(surface, props),
    onUpdate: (props: RichEditorTooltipSuggestion) => getController()?.updateSuggestion(surface, props),
    onExit: () => getController()?.removeSuggestion(surface),
    onKeyDown: ({ event }: { event: KeyboardEvent }) => (
      getController()?.handleSuggestionKeyDown(surface, event) || false
    ),
  };
}

export function hasUnsuitableContext($position: ResolvedPos) {
  for (let depth = $position.depth; depth > 0; depth--) {
    const node = $position.node(depth);
    if (isUnsuitableNode(node.type.name) || node.type.spec.code) {
      return true;
    }
  }

  return false;
}

export function isUnsuitableNode(typeName: string) {
  return typeName === 'codeBlock'
    || typeName === 'mathBlock'
    || typeName === 'mathInline'
    || typeName === 'mention'
    || typeName === 'customEmoji';
}

export function buildBlockMatch($position: ResolvedPos, text: string, query: string) {
  return {
    range: { from: $position.pos - text.length, to: $position.pos },
    query,
    text,
  };
}

export function getSolePlainTextAtCaret($position: ResolvedPos) {
  if (
    $position.depth !== 1
    || !$position.parent.isTextblock
    || $position.parentOffset !== $position.parent.content.size
    || $position.node(0).childCount !== 1
    || hasUnsuitableContext($position)
  ) {
    return undefined;
  }

  let isPlainText = true;
  $position.parent.forEach((node) => {
    isPlainText &&= node.isText && !node.marks.length;
  });
  return isPlainText ? $position.parent.textContent : undefined;
}
