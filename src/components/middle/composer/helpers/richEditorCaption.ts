import { mergeAttributes } from '@tiptap/core';
import type { NodeType } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { Plugin } from '@tiptap/pm/state';

import { CAPTION_NODE_NAME } from '../../../../util/tiptap/constants';
import { RICH_INPUT_MODE_CHANGED_META } from './richEditorMode';
import { isRichEditorQuoteNode, type RichEditorQuoteHtmlAttributes } from './richEditorQuote';
import buildRichEditorTextField from './richEditorTextField';

type RichEditorCaptionOptions = {
  HTMLAttributes: RichEditorQuoteHtmlAttributes;
  getIsRichInputExpanded: () => boolean;
};

const EMPTY_CAPTION_NODE_SIZE = 2;

const RichEditorCaptionNode = buildRichEditorTextField({
  name: CAPTION_NODE_NAME,
  dataAttribute: 'data-rich-editor-caption',
});

export const RichEditorCaption = RichEditorCaptionNode.extend<RichEditorCaptionOptions>({
  isolating: true,
  priority: 110,

  parseHTML() {
    return [
      { tag: 'cite' },
      { tag: 'footer[data-rich-block-type="quoteCaption"]' },
      ...(this.parent?.() || []),
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['cite', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  renderMarkdown(node, helpers) {
    return helpers.renderChildren(node);
  },

  addOptions() {
    return {
      HTMLAttributes: this.parent?.().HTMLAttributes || {},
      getIsRichInputExpanded: () => false,
    };
  },

  addProseMirrorPlugins() {
    const captionType = this.type;
    return [
      ...(this.parent?.() || []),
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => (
            transaction.docChanged || transaction.getMeta(RICH_INPUT_MODE_CHANGED_META)
          ))) {
            return undefined;
          }

          const transaction = newState.tr;
          return updateQuoteCaptions(
            transaction,
            captionType,
            this.options.getIsRichInputExpanded(),
          ) ? transaction : undefined;
        },
      }),
    ];
  },
});

function updateQuoteCaptions(
  transaction: Transaction,
  captionType: NodeType,
  isRichInputExpanded: boolean,
) {
  const positions: number[] = [];
  transaction.doc.descendants((node, pos) => {
    if (!isRichEditorQuoteNode(node)) return;

    const caption = node.lastChild?.type === captionType ? node.lastChild : undefined;
    if (isRichInputExpanded && !caption) {
      positions.push(pos + node.nodeSize - 1);
    } else if (!isRichInputExpanded && caption && !caption.content.size) {
      positions.push(pos + node.nodeSize - caption.nodeSize - 1);
    }
  });

  // Positions target quote-end insertion or the start of a final empty caption; descending order preserves offsets
  positions.sort((left, right) => right - left).forEach((pos) => {
    if (isRichInputExpanded) {
      transaction.insert(pos, captionType.create());
    } else {
      transaction.delete(pos, pos + EMPTY_CAPTION_NODE_SIZE);
    }
  });
  return Boolean(positions.length);
}
