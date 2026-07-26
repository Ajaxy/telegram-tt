import {
  InputRule, mergeAttributes, Node as TiptapNode, wrappingInputRule,
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
  unsetRichEditorQuote,
} from './richEditorQuote';

import Blockquote from '../../../common/quote/Blockquote';

type RichEditorBlockquoteOptions = {
  HTMLAttributes: Record<string, unknown>;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockQuote: {
      setBlockquote: () => ReturnType;
      toggleBlockquote: () => ReturnType;
      unsetBlockquote: () => ReturnType;
    };
  }
}

const BLOCKQUOTE_INPUT_REGEX = /^\s*>\s$/;

function RichEditorBlockquoteView({
  HTMLAttributes,
}: TeactNodeViewComponentProps) {
  const className = typeof HTMLAttributes.class === 'string' ? HTMLAttributes.class : undefined;

  return (
    <Blockquote className={className}>
      <NodeViewContent />
    </Blockquote>
  );
}

export function buildRichEditorBlockquote(getIsRichInputExpanded: () => boolean) {
  return TiptapNode.create<RichEditorBlockquoteOptions>({
    name: 'blockquote',
    group: 'block',
    content: `block+ ${CAPTION_NODE_NAME}?`,
    defining: true,
    isolating: true,

    addOptions() {
      return { HTMLAttributes: {} };
    },

    parseHTML() {
      return [{ tag: 'blockquote' }];
    },

    renderHTML({ HTMLAttributes }) {
      return ['blockquote', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addNodeView() {
      return TeactNodeViewRenderer(RichEditorBlockquoteView);
    },

    addCommands() {
      return {
        setBlockquote: () => ({ commands }) => commands.wrapIn(this.name),
        toggleBlockquote: () => ({ state, commands, dispatch }) => {
          return isSelectionInsideRichEditorQuote(state.selection, this.name)
            ? unsetRichEditorQuote(state, dispatch, this.name)
            : commands.wrapIn(this.name);
        },
        unsetBlockquote: () => ({ state, dispatch }) => {
          return unsetRichEditorQuote(state, dispatch, this.name);
        },
      };
    },

    addKeyboardShortcuts() {
      return {
        'Mod-Shift-b': () => this.editor.commands.toggleBlockquote(),
        Backspace: () => handleRichEditorQuoteBackspace(this.editor, this.name),
        ArrowUp: () => handleRichEditorQuoteArrow(this.editor, this.name, -1),
        ArrowDown: () => handleRichEditorQuoteArrow(this.editor, this.name, 1),
        Enter: () => handleRichEditorQuoteEnter(this.editor, this.name),
      };
    },

    addInputRules() {
      const rule = wrappingInputRule({ find: BLOCKQUOTE_INPUT_REGEX, type: this.type });
      return [new InputRule({
        find: rule.find,
        handler: (props) => {
          if (
            !getIsRichInputExpanded()
            && isSelectionInsideRichEditorQuote(props.state.selection, this.name)
          ) {
            return;
          }

          return rule.handler(props);
        },
        undoable: rule.undoable,
      })];
    },
  });
}
