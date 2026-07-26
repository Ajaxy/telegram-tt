/* eslint-disable no-null/no-null */
import type {
  Editor, Range as TiptapRange,
} from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { Suggestion, type SuggestionMatch } from '@tiptap/suggestion';
import { getActions } from '../../../../../global';

import type { ApiSticker } from '../../../../../api/types';
import type {
  RichEditorInsertContent,
} from '../../../../middle/composer/richEditorTypes';
import type {
  RichEditorTooltipItem,
  RichEditorTooltipsConfig,
  RichEditorTooltipSuggestion,
} from '../../types';

import twemojiRegex from '../../../../../lib/twemojiRegex';
import { replaceEditorRange } from '../../../../middle/composer/helpers/richEditorComposer';
import {
  buildSuggestionRenderer,
  type GetTooltipController,
  hasUnsuitableContext,
  PLUGIN_KEYS,
  TOOLTIP_GAP_PX,
} from './suggestion';

type NativeEmojiSurface = 'customEmoji' | 'sticker';

export function buildNativeEmojiSuggestion(
  surface: NativeEmojiSurface,
  editor: Editor,
  config: RichEditorTooltipsConfig,
  getController: GetTooltipController,
) {
  return Suggestion<RichEditorTooltipItem, RichEditorTooltipItem>({
    editor,
    pluginKey: PLUGIN_KEYS[surface],
    placement: 'top-start',
    offset: { mainAxis: TOOLTIP_GAP_PX },
    dismissOnOutsideClick: false,
    findSuggestionMatch: surface === 'sticker' ? findStickerMatch : findRepeatedEmojiMatch,
    allow: () => config[surface]!.isEnabled(),
    command: ({ editor: currentEditor, range, props }) => {
      const sticker = props as ApiSticker;
      if (surface === 'sticker') {
        config.sticker?.onSelect(sticker);
        return;
      }

      const count = countEmojiInRange(currentEditor.state.doc, range, sticker.emoji || '');
      const content: RichEditorInsertContent = { type: 'customEmoji', emoji: sticker };
      replaceEditorRange(currentEditor, range, Array.from({ length: count }, () => content));
    },
    shouldResetDismissed: ({ transaction }) => transaction.docChanged,
    render: () => buildNativeEmojiRenderer(surface, getController),
  });
}

function buildNativeEmojiRenderer(
  surface: NativeEmojiSurface,
  getController: GetTooltipController,
) {
  const renderer = buildSuggestionRenderer(surface, getController);
  let currentEmoji: string | undefined;
  return {
    onStart: (props: RichEditorTooltipSuggestion) => {
      currentEmoji = props.query;
      loadNativeEmojiSurface(surface, props.query);
      renderer.onStart(props);
    },
    onUpdate: (props: RichEditorTooltipSuggestion) => {
      if (props.query !== currentEmoji) {
        currentEmoji = props.query;
        loadNativeEmojiSurface(surface, props.query);
      }
      renderer.onUpdate(props);
    },
    onExit: () => {
      clearNativeEmojiSurface(surface);
      renderer.onExit();
    },
    onKeyDown: renderer.onKeyDown,
  };
}

function findRepeatedEmojiMatch({ $position }: { $position: ResolvedPos }): SuggestionMatch {
  if (!$position.parent.isTextblock || hasUnsuitableContext($position)) {
    return null;
  }

  const units = collectEmojiUnits($position);
  const last = units.at(-1);
  if (!last || last.to !== $position.parentOffset) {
    return null;
  }

  let start = last.from;
  for (let index = units.length - 2; index >= 0; index--) {
    const unit = units[index];
    if (unit.emoji !== last.emoji || unit.to !== start) {
      break;
    }
    start = unit.from;
  }

  const parentStart = $position.start();
  return {
    range: { from: parentStart + start, to: $position.pos },
    query: last.emoji,
    text: last.emoji.repeat(units.filter((unit) => unit.from >= start).length),
  };
}

function findStickerMatch(trigger: { $position: ResolvedPos }): SuggestionMatch {
  const match = findRepeatedEmojiMatch(trigger);
  if (!match || match.text !== match.query) {
    return null;
  }

  const { $position } = trigger;
  if (
    $position.depth !== 1
    || match.range.from !== $position.start()
    || $position.parentOffset !== $position.parent.content.size
    || $position.parent.childCount !== 1
    || $position.node(0).childCount !== 1
  ) {
    return null;
  }

  return match;
}

function collectEmojiUnits($position: ResolvedPos) {
  const units: { emoji: string; from: number; to: number }[] = [];
  $position.parent.forEach((node, offset) => {
    if (offset >= $position.parentOffset) {
      return;
    }

    const end = Math.min(offset + node.nodeSize, $position.parentOffset);
    if (node.isText && node.text) {
      for (const match of node.text.slice(0, end - offset).matchAll(twemojiRegex)) {
        if (match.index !== undefined) {
          units.push({
            emoji: match[0],
            from: offset + match.index,
            to: offset + match.index + match[0].length,
          });
        }
      }
    } else if (node.type.name === 'emoji' && typeof node.attrs.alt === 'string') {
      units.push({ emoji: node.attrs.alt, from: offset, to: offset + node.nodeSize });
    }
  });
  return units;
}

function loadNativeEmojiSurface(surface: NativeEmojiSurface, emoji: string) {
  const actions = getActions();
  if (surface === 'customEmoji') {
    actions.loadCustomEmojiForEmoji({ emoji });
  } else {
    actions.loadStickersForEmoji({ emoji });
  }
}

function clearNativeEmojiSurface(surface: NativeEmojiSurface) {
  const actions = getActions();
  if (surface === 'customEmoji') {
    actions.clearCustomEmojiForEmoji();
  } else {
    actions.clearStickersForEmoji();
  }
}

function countEmojiInRange(doc: ProseMirrorNode, range: TiptapRange, emoji: string) {
  let count = 0;
  doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (node.type.name === 'emoji' && node.attrs.alt === emoji) {
      count++;
    } else if (node.isText && node.text) {
      const from = Math.max(range.from, pos) - pos;
      const to = Math.min(range.to, pos + node.nodeSize) - pos;
      const text = node.text.slice(from, to);
      count += Array.from(text.matchAll(twemojiRegex)).filter((match) => match[0] === emoji).length;
    }
  });
  return Math.max(count, 1);
}
