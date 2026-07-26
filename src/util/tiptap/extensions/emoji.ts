import {
  combineTransactionSteps,
  findChildrenInRange,
  getChangedRanges,
  Node,
} from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { Plugin } from '@tiptap/pm/state';

import EMOJI_REGEX from '../../../lib/twemojiRegex';
import { IS_EMOJI_SUPPORTED } from '../../browser/windowEnvironment';
import buildClassName from '../../buildClassName';
import { nativeToUnifiedExtendedWithCache } from '../../emoji/emoji';
import { EMOJI_NODE_NAME } from '../constants';
import buildDefinedAttributes from './buildDefinedAttributes';

import styles from '../styling.module.scss';

export const EmojiNode = Node.create({
  name: EMOJI_NODE_NAME,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      alt: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('alt') || '',
      },
      src: {
        default: undefined,
        parseHTML: (element: HTMLElement) => element.getAttribute('src') || undefined,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img.emoji:not([data-document-id])' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', buildDefinedAttributes({
      class: buildClassName(styles.emoji, styles.emojiImage),
      alt: HTMLAttributes.alt,
      src: HTMLAttributes.src,
      draggable: 'false',
    })];
  },

  renderText({ node }) {
    return node.attrs.alt;
  },

  addProseMirrorPlugins() {
    return IS_EMOJI_SUPPORTED ? [] : [
      new Plugin({
        appendTransaction: (transactions, oldState, newState) => {
          if (this.editor.view.composing) {
            return undefined;
          }

          const hasDocChanges = transactions.some((transaction) => transaction.docChanged)
            && !oldState.doc.eq(newState.doc);
          if (!hasDocChanges) {
            return undefined;
          }

          const transaction = newState.tr;
          if (transactions.some((item) => item.getMeta('preventUpdate'))) {
            transaction.setMeta('preventUpdate', true);
          }
          const transform = combineTransactionSteps(oldState.doc, transactions as Transaction[]);
          const changedRanges = getChangedRanges(transform);

          changedRanges.forEach(({ newRange }) => {
            if (newState.doc.resolve(newRange.from).parent.type.spec.code) {
              return;
            }

            const textNodes = findChildrenInRange(newState.doc, newRange, (node) => node.type.isText);
            textNodes.forEach(({ node, pos }) => {
              if (!node.text) {
                return;
              }

              for (const match of node.text.matchAll(EMOJI_REGEX)) {
                if (match.index === undefined) {
                  continue;
                }

                const attrs = buildEmojiAttrs(match[0]);
                if (!attrs) {
                  continue;
                }

                const from = transaction.mapping.map(pos + match.index);
                if (transaction.doc.resolve(from).parent.type.spec.code) {
                  continue;
                }

                transaction.replaceRangeWith(from, from + match[0].length, this.type.create(attrs));
                transaction.setStoredMarks(transaction.doc.resolve(from).marks());
              }
            });
          });

          return transaction.steps.length ? transaction : undefined;
        },
      }),
    ];
  },
});

function buildEmojiSrc(emoji: string) {
  const code = nativeToUnifiedExtendedWithCache(emoji);

  return code ? `./img-apple-64/${code}.png` : undefined;
}

function buildEmojiAttrs(emoji: string) {
  const src = buildEmojiSrc(emoji);
  if (!src) {
    return undefined;
  }

  return {
    alt: emoji,
    src,
  };
}
