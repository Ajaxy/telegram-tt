import { Mark, markInputRule } from '@tiptap/core';

import styles from '../styling.module.scss';

const INPUT_REGEX = /(?:^|\s)(==(?=\S)(.*?\S)==)$/;
const TOKEN_REGEX = /^==(?=\S)(.*?\S)==/;

export const MarkedTextMark = Mark.create({
  name: 'marked',

  parseHTML() {
    return [{ tag: 'mark' }];
  },

  renderHTML() {
    return ['mark', {
      class: styles.markedText,
    }, 0];
  },

  parseMarkdown(token, helpers) {
    return helpers.applyMark('marked', helpers.parseInline(token.tokens || []));
  },

  renderMarkdown(node, helpers) {
    return `==${helpers.renderChildren(node)}==`;
  },

  markdownTokenizer: {
    name: 'marked',
    level: 'inline',
    start: (source) => source.indexOf('=='),
    tokenize: (source, _tokens, lexer) => {
      const match = TOKEN_REGEX.exec(source);
      if (!match) {
        return undefined;
      }

      return {
        type: 'marked',
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
});
