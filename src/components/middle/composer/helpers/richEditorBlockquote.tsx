import {
  InputRule, mergeAttributes, Node as TiptapNode, wrappingInputRule,
} from '@tiptap/core';

import {
  NodeViewContent,
  type TeactNodeViewComponentProps,
  TeactNodeViewRenderer,
} from '../../../../util/tiptap';
import {
  BLOCKQUOTE_COLLAPSED_ATTR,
  CAPTION_NODE_NAME,
} from '../../../../util/tiptap/constants';
import { RICH_INPUT_MODE_CHANGED_META } from './richEditorMode';
import {
  handleRichEditorQuoteArrow,
  handleRichEditorQuoteBackspace,
  handleRichEditorQuoteEnter,
  isSelectionInsideRichEditorQuote,
  type RichEditorQuoteHtmlAttributes,
  unsetRichEditorQuote,
} from './richEditorQuote';

import useLastCallback from '../../../../hooks/useLastCallback';

import Blockquote from '../../../common/quote/Blockquote';

type RichEditorBlockquoteOptions = {
  HTMLAttributes: RichEditorQuoteHtmlAttributes;
};

type RichEditorBlockquoteViewProps = TeactNodeViewComponentProps & {
  isRichInputExpanded: boolean;
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
  isRichInputExpanded,
  node,
  updateAttributes,
}: RichEditorBlockquoteViewProps) {
  const className = typeof HTMLAttributes.class === 'string' ? HTMLAttributes.class : undefined;
  const isCollapsed = Boolean(node.attrs[BLOCKQUOTE_COLLAPSED_ATTR]);

  const handleCollapseChange = useLastCallback((isNextCollapsed: boolean) => {
    updateAttributes({ [BLOCKQUOTE_COLLAPSED_ATTR]: isNextCollapsed });
  });

  return (
    <Blockquote
      className={className}
      canBeCollapsible={!isRichInputExpanded}
      noInitialCollapse={!isCollapsed}
      recalculationKey={node}
      isCollapsed={isCollapsed}
      onCollapseChange={handleCollapseChange}
    >
      <NodeViewContent />
    </Blockquote>
  );
}

export function buildRichEditorBlockquote(getIsRichInputExpanded: () => boolean) {
  function renderRichEditorBlockquoteView(props: TeactNodeViewComponentProps) {
    return (
      <RichEditorBlockquoteView
        {...props}
        isRichInputExpanded={getIsRichInputExpanded()}
      />
    );
  }

  return TiptapNode.create<RichEditorBlockquoteOptions>({
    name: 'blockquote',
    group: 'block',
    content: `block+ ${CAPTION_NODE_NAME}?`,
    defining: true,
    isolating: true,

    addOptions() {
      return { HTMLAttributes: {} };
    },

    addAttributes() {
      return {
        [BLOCKQUOTE_COLLAPSED_ATTR]: {
          default: false,
          parseHTML: (element) => element.hasAttribute('data-collapsed'),
          renderHTML: (attributes) => attributes[BLOCKQUOTE_COLLAPSED_ATTR]
            ? { 'data-collapsed': 'true' }
            : {},
        },
      };
    },

    parseHTML() {
      return [{ tag: 'blockquote' }];
    },

    renderHTML({ HTMLAttributes }) {
      return ['blockquote', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    renderMarkdown(node, helpers) {
      if (!node.content) return '';

      return node.content.map((child, index) => {
        const content = helpers.renderChild?.(child, index) || helpers.renderChildren([child]);
        return content.split('\n').map((line) => (line.trim() ? `> ${line}` : '>')).join('\n');
      }).join('\n>\n');
    },

    parseMarkdown(token, helpers) {
      const parseChildren = helpers.parseBlockChildren || helpers.parseChildren;
      return helpers.createNode('blockquote', undefined, parseChildren(token.tokens || []));
    },

    addNodeView() {
      return TeactNodeViewRenderer(renderRichEditorBlockquoteView, {
        shouldUpdateOnTransaction: ({ transaction }) => (
          Boolean(transaction.getMeta(RICH_INPUT_MODE_CHANGED_META))
        ),
      });
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
