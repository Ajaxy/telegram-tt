/* eslint-disable no-null/no-null */
import type { Editor } from '@tiptap/core';
import type { ResolvedPos } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Suggestion, type SuggestionMatch } from '@tiptap/suggestion';
import { getActions } from '../../../../../global';

import type { RichEditorTooltipItem, RichEditorTooltipsConfig } from '../../types';

import {
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
    findSuggestionMatch: ({ $position }) => findInlineBotMatch($position, config),
    allow: () => config.inlineBot!.isEnabled(),
    debounce: SEARCH_DEBOUNCE_MS,
    items: ({ editor: currentEditor }) => {
      const text = getSolePlainTextAtCaret(currentEditor.state.selection.$from, true);
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

const HELP_PLUGIN_KEY = new PluginKey<string | undefined>('richEditorInlineBotHelp');

// Rendered inside the editor at the caret, so it follows both plain `@bot` text and mention chips
export function buildInlineBotHelpPlugin() {
  return new Plugin<string | undefined>({
    key: HELP_PLUGIN_KEY,
    state: {
      init: () => undefined,
      apply: (tr, help) => {
        const meta = tr.getMeta(HELP_PLUGIN_KEY) as { help?: string } | undefined;
        return meta ? meta.help : help;
      },
    },
    props: {
      decorations(state) {
        const help = HELP_PLUGIN_KEY.getState(state);
        const { $from } = state.selection;
        // Help arrives async, so skip it if the query was typed in the meantime
        if (!help || parseInlineBotQuery(getSolePlainTextAtCaret($from, true))?.query !== '') {
          return undefined;
        }

        return DecorationSet.create(state.doc, [
          Decoration.widget($from.pos, () => buildHelpElement(help), { side: 1, ignoreSelection: true, key: help }),
        ]);
      },
    },
  });
}

export function setInlineBotHelp(editor: Editor, help?: string) {
  if (editor.isDestroyed || HELP_PLUGIN_KEY.getState(editor.state) === help) {
    return;
  }

  editor.view.dispatch(editor.state.tr.setMeta(HELP_PLUGIN_KEY, { help }).setMeta('addToHistory', false));
}

function buildHelpElement(help: string) {
  const element = document.createElement('span');
  element.className = 'inline-bot-help';
  element.contentEditable = 'false';
  const text = document.createElement('span');
  text.className = 'inline-bot-help-text';
  text.textContent = help;
  element.append(text);
  return element;
}

function findInlineBotMatch($position: ResolvedPos, config: RichEditorTooltipsConfig): SuggestionMatch {
  const text = getSolePlainTextAtCaret($position, true);
  const query = parseInlineBotQuery(text);
  // A leading mention of a non-bot user must not block the mention tooltip for the next `@`
  if (query && config.getContext().inlineBots?.[query.username.toLowerCase()] === false) {
    return null;
  }

  // Text length is not the doc range when a mention node adds its open/close tokens
  return query ? { range: { from: $position.start(), to: $position.pos }, query: query.query, text: text! } : null;
}
