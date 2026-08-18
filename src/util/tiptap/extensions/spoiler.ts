import { Mark, markInputRule } from '@tiptap/core';

import { ApiMessageEntityTypes } from '../../../api/types';

import styles from '../styling.module.scss';

const INPUT_REGEX = /(?:^|\s)(\|\|(?=\S)(.*?\S)\|\|)$/;
const TOKEN_REGEX = /^\|\|(?=\S)(.*?\S)\|\|/;

export const SpoilerMark = Mark.create({
  name: 'spoiler',

  parseHTML() {
    return [
      { tag: 'tg-spoiler' },
      { tag: 'span[data-rich-text-type="spoiler"]' },
      { tag: `span[data-entity-type="${ApiMessageEntityTypes.Spoiler}"]` },
    ];
  },

  renderHTML() {
    return ['tg-spoiler', {
      class: styles.spoiler,
    }, 0];
  },

  parseMarkdown(token, helpers) {
    return helpers.applyMark('spoiler', helpers.parseInline(token.tokens || []));
  },

  renderMarkdown(node, helpers) {
    return `||${helpers.renderChildren(node)}||`;
  },

  markdownTokenizer: {
    name: 'spoiler',
    level: 'inline',
    start: (source) => source.indexOf('||'),
    tokenize: (source, _tokens, lexer) => {
      const match = TOKEN_REGEX.exec(source);
      if (!match) {
        return undefined;
      }

      return {
        type: 'spoiler',
        raw: match[0],
        text: match[1],
        tokens: lexer.inlineTokens(match[1]),
      };
    },
  },

  addInputRules() {
    return [markInputRule({
      find: INPUT_REGEX,
      type: this.type,
    })];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-p': () => {
        if (this.editor.state.selection.empty && !this.editor.isActive(this.name)) {
          return false;
        }

        return this.editor.commands.toggleMark(this.name);
      },
      'Mod-P': () => this.editor.commands.toggleMark(this.name),
    };
  },
});
