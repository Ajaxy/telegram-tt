/* eslint-disable no-null/no-null */
import type { Editor } from '@tiptap/core';
import type { ResolvedPos } from '@tiptap/pm/model';
import { Suggestion, type SuggestionMatch } from '@tiptap/suggestion';
import { getActions } from '../../../../../global';

import type { RichEditorTooltipItem, RichEditorTooltipsConfig } from '../../types';

import {
  buildBlockMatch,
  buildSuggestionRenderer,
  getSolePlainTextAtCaret,
  type GetTooltipController,
  parseInlineBotQuery,
  PLUGIN_KEYS,
  SEARCH_DEBOUNCE_MS,
  TOOLTIP_GAP_PX,
} from './suggestion';

export function buildInlineBotSuggestion(
  editor: Editor,
  config: RichEditorTooltipsConfig,
  getController: GetTooltipController,
) {
  let queriedUsername: string | undefined;

  return Suggestion<RichEditorTooltipItem, RichEditorTooltipItem>({
    editor,
    pluginKey: PLUGIN_KEYS.inlineBot,
    placement: 'top-start',
    offset: { mainAxis: TOOLTIP_GAP_PX },
    dismissOnOutsideClick: false,
    allowSpaces: true,
    findSuggestionMatch: findInlineBotMatch,
    allow: () => config.inlineBot!.isEnabled(),
    debounce: SEARCH_DEBOUNCE_MS,
    items: ({ editor: currentEditor }) => {
      const text = getSolePlainTextAtCaret(currentEditor.state.selection.$from);
      const query = parseInlineBotQuery(text);
      if (!query) {
        return [];
      }

      const username = query.username.toLowerCase();
      if (queriedUsername && queriedUsername !== username) {
        getActions().resetInlineBot({ username: queriedUsername });
      }
      queriedUsername = username;
      getActions().queryInlineBot({
        chatId: config.getContext().chatId,
        username,
        query: query.query,
      });
      return [];
    },
    shouldResetDismissed: ({ transaction }) => transaction.docChanged,
    render: () => {
      const renderer = buildSuggestionRenderer('inlineBot', getController);
      return {
        ...renderer,
        onExit: () => {
          if (queriedUsername) {
            getActions().resetInlineBot({ username: queriedUsername });
          }
          queriedUsername = undefined;
          renderer.onExit();
        },
      };
    },
  });
}

function findInlineBotMatch({ $position }: { $position: ResolvedPos }): SuggestionMatch {
  const text = getSolePlainTextAtCaret($position);
  const query = parseInlineBotQuery(text);
  return query ? buildBlockMatch($position, text!, query.query) : null;
}
