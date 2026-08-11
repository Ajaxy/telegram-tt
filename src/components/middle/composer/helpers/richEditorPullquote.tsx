import {
  mergeAttributes, Node as TiptapNode,
} from '@tiptap/core';

import {
  NodeViewContent,
  type TeactNodeViewComponentProps,
  TeactNodeViewRenderer,
} from '../../../../util/tiptap';
import { CAPTION_NODE_NAME } from '../../../../util/tiptap/constants';
import {
  handleRichEditorQuoteArrow,
  handleRichEditorQuoteBackspace,
  handleRichEditorQuoteEnter,
  isSelectionInsideRichEditorQuote,
  type RichEditorQuoteHtmlAttributes,
  unsetRichEditorQuote,
} from './richEditorQuote';

import Pullquote from '../../../common/quote/Pullquote';

type RichEditorPullquoteOptions = {
  HTMLAttributes: RichEditorQuoteHtmlAttributes;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pullquote: {
      setPullquote: () => ReturnType;
      togglePullquote: () => ReturnType;
      unsetPullquote: () => ReturnType;
    };
  }
}

function RichEditorPullquoteView({
  HTMLAttributes,
}: TeactNodeViewComponentProps) {
  const className = typeof HTMLAttributes.class === 'string' ? HTMLAttributes.class : undefined;

  return (
    <Pullquote className={className}>
      <NodeViewContent />
    </Pullquote>
  );
}

export const RichEditorPullquote = TiptapNode.create<RichEditorPullquoteOptions>({
  name: 'pullquote',
  group: 'block',
  content: `paragraph+ ${CAPTION_NODE_NAME}?`,
  defining: true,
  isolating: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  parseHTML() {
    return [{ tag: 'aside' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addNodeView() {
    return TeactNodeViewRenderer(RichEditorPullquoteView);
  },

  addCommands() {
    return {
      setPullquote: () => ({ state, commands }) => {
        if (isSelectionInsideRichEditorQuote(state.selection)) {
          return false;
        }

        return commands.wrapIn(this.name);
      },
      togglePullquote: () => ({ state, commands, dispatch }) => {
        if (isSelectionInsideRichEditorQuote(state.selection, this.name)) {
          return unsetRichEditorQuote(state, dispatch, this.name);
        }
        if (isSelectionInsideRichEditorQuote(state.selection)) {
          return false;
        }

        return commands.wrapIn(this.name);
      },
      unsetPullquote: () => ({ state, dispatch }) => {
        return unsetRichEditorQuote(state, dispatch, this.name);
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => handleRichEditorQuoteBackspace(this.editor, this.name),
      ArrowUp: () => handleRichEditorQuoteArrow(this.editor, this.name, -1),
      ArrowDown: () => handleRichEditorQuoteArrow(this.editor, this.name, 1),
      Enter: () => handleRichEditorQuoteEnter(this.editor, this.name),
    };
  },
});
