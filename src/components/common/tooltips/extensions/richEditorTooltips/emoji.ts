/* eslint-disable no-null/no-null */
import type { Editor } from '@tiptap/core';
import type { ResolvedPos } from '@tiptap/pm/model';
import { Suggestion, type SuggestionMatch } from '@tiptap/suggestion';
import { getGlobal } from '../../../../../global';

import type { ApiSticker } from '../../../../../api/types';
import type { EmojiData, EmojiModule } from '../../../../../util/emoji/emoji';
import type {
  RichEditorTooltipItem,
  RichEditorTooltipsConfig,
  RichEditorTooltipSuggestion,
} from '../../types';

import { selectCustomEmojiForEmojis } from '../../../../../global/selectors';
import { uncompressEmoji } from '../../../../../util/emoji/emoji';
import { prepareEmojiLibraryMemo, searchEmojiLibraryMemo } from '../../../../../util/emoji/emojiSearch';
import { pickTruthy, uniqueByField } from '../../../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../../../util/memo';
import memoized from '../../../../../util/memoized';
import { replaceEditorRange } from '../../../../middle/composer/helpers/richEditorComposer';
import {
  buildBlockMatch,
  buildSuggestionRenderer,
  type GetTooltipController,
  hasUnsuitableContext,
  PLUGIN_KEYS,
  SEARCH_DEBOUNCE_MS,
  TOOLTIP_GAP_PX,
} from './suggestion';

const EMOJI_LIMIT = 36;
const EMOJI_FILTER_MIN_LENGTH = 2;

let emojiDataPromise: Promise<EmojiModule> | undefined;
let emojiData: EmojiData;
const RE_EMOJI_SEARCH = /(^|\s):(?!\s)[-+_:'\s\p{L}\p{N}]*$/ui;
const RE_LOWERCASE_TEST = /\p{Ll}/u;

const prepareRecentEmojisMemo = memoized(prepareRecentEmojis);

export function buildEmojiSuggestion(
  editor: Editor,
  config: RichEditorTooltipsConfig,
  getController: GetTooltipController,
) {
  return Suggestion<RichEditorTooltipItem, RichEditorTooltipItem>({
    editor,
    pluginKey: PLUGIN_KEYS.emoji,
    placement: 'top-start',
    offset: { mainAxis: TOOLTIP_GAP_PX },
    dismissOnOutsideClick: false,
    allowSpaces: true,
    findSuggestionMatch: findEmojiShortcodeMatch,
    allow: () => config.emoji!.isEnabled(),
    debounce: SEARCH_DEBOUNCE_MS,
    items: ({ query, signal }) => filterEmojiItems(config, query, signal),
    command: ({ editor: currentEditor, range, props }) => {
      if ('native' in props) {
        replaceEditorRange(currentEditor, range, { type: 'text', text: props.native });
        config.emoji!.addRecentEmoji({ emoji: props.id });
        return;
      }

      const customEmoji = props as ApiSticker;
      replaceEditorRange(currentEditor, range, { type: 'customEmoji', emoji: customEmoji });
      config.emoji!.addRecentCustomEmoji({ documentId: customEmoji.id });
    },
    shouldResetDismissed: ({ transaction }) => transaction.docChanged,
    render: () => {
      const renderer = buildSuggestionRenderer('emoji', getController);
      return {
        ...renderer,
        onStart: (props: RichEditorTooltipSuggestion) => {
          if (!checkAutoInsertEmoji(props)) {
            renderer.onStart(props);
          }
        },
        onUpdate: (props: RichEditorTooltipSuggestion) => {
          if (!checkAutoInsertEmoji(props)) {
            renderer.onUpdate(props);
          }
        },
      };
    },
  });
}

function findEmojiShortcodeMatch({ $position }: { $position: ResolvedPos }): SuggestionMatch {
  if (!$position.parent.isTextblock || hasUnsuitableContext($position)) {
    return null;
  }

  const textBefore = $position.parent.textBetween(0, $position.parentOffset, '\n', '\n');
  const matchedText = textBefore.match(RE_EMOJI_SEARCH)?.[0];
  if (!matchedText || /\s$/u.test(matchedText)) {
    return null;
  }

  const text = matchedText.trim();
  return buildBlockMatch($position, text, text.slice(1));
}

async function filterEmojiItems(config: RichEditorTooltipsConfig, query: string, signal: AbortSignal) {
  await ensureEmojiData();
  if (signal.aborted) {
    return MEMO_EMPTY_ARRAY;
  }

  const context = config.getContext();
  const shouldAutoInsert = query.length > 1 && query.endsWith(':');
  const filter = query.slice(0, shouldAutoInsert ? -1 : undefined);
  let emojis: Emoji[] = MEMO_EMPTY_ARRAY;
  if (!filter) {
    emojis = prepareRecentEmojisMemo(emojiData.emojis, context.recentEmojiIds || [], EMOJI_LIMIT);
  } else if ((filter.length === 1 && RE_LOWERCASE_TEST.test(filter)) || filter.length >= EMOJI_FILTER_MIN_LENGTH) {
    const library = prepareEmojiLibraryMemo(
      emojiData.emojis,
      context.baseEmojiKeywords,
      context.emojiKeywords,
    );
    emojis = searchEmojiLibraryMemo(library, filter.toLowerCase(), EMOJI_LIMIT);
  }

  if (!emojis.length) {
    return MEMO_EMPTY_ARRAY;
  }

  const customEmojis = uniqueByField(
    selectCustomEmojiForEmojis(getGlobal(), emojis.map((emoji) => emoji.native)),
    'id',
  );
  return [...emojis, ...customEmojis];
}

function checkAutoInsertEmoji(props: RichEditorTooltipSuggestion) {
  if (!props.text.endsWith(':') || props.text.length <= 2 || !props.items.length) {
    return false;
  }

  props.command(props.items[0]);
  return true;
}

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiData = uncompressEmoji((await emojiDataPromise).default);
  }

  return emojiDataPromise;
}

function prepareRecentEmojis(byId: Record<string, Emoji>, recentEmojiIds: string[], limit: number) {
  return recentEmojiIds.length
    ? Object.values(pickTruthy(byId, recentEmojiIds)).slice(0, limit)
    : MEMO_EMPTY_ARRAY;
}
