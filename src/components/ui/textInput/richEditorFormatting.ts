import { type Editor, Extension } from '@tiptap/core';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection, type Transaction } from '@tiptap/pm/state';
import { canSplit, findWrapping } from '@tiptap/pm/transform';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { unwrapRichEditorQuote } from '../../middle/composer/helpers/richEditorQuote';

import styles from './TextFormatter.module.scss';

type EditorRange = { from: number; to: number };
type SelectedNode = { node: ProseMirrorNode; position: number };

const BLOCKQUOTE_NODE_TYPE = 'blockquote';
const BLOCK_SEPARATOR = '\n';
const CODE_BLOCK_NODE_TYPE = 'codeBlock';
const CODE_MARK_TYPE = 'code';
const PARAGRAPH_NODE_TYPE = 'paragraph';
const FORMATTER_SELECTION_HIGHLIGHT_KEY = new PluginKey<boolean>('formatterSelectionHighlight');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    richEditorFormatting: {
      toggleSelectionBlockquote: () => ReturnType;
      toggleSelectionCode: () => ReturnType;
      setFormatterSelectionHighlight: (isVisible: boolean) => ReturnType;
    };
  }
}

export function buildRichEditorFormatting(getIsRichInputExpanded: () => boolean) {
  return Extension.create({
    name: 'richEditorFormatting',

    addCommands() {
      return {
        toggleSelectionCode: () => ({ state, tr, commands, dispatch }) => {
          const range = { from: state.selection.from, to: state.selection.to };
          const codeBlocks = getSelectedNodes(state.doc, range, CODE_BLOCK_NODE_TYPE);
          if (codeBlocks.length) {
            if (dispatch) {
              unwrapSelectedCodeBlocks(tr, codeBlocks);
              restoreMappedSelection(tr, range);
            }
            return true;
          }

          if (state.doc.rangeHasMark(range.from, range.to, state.schema.marks[CODE_MARK_TYPE])) {
            return commands.unsetMark(CODE_MARK_TYPE);
          }

          const text = state.doc.textBetween(range.from, range.to, BLOCK_SEPARATOR, BLOCK_SEPARATOR).trim();
          if (!text) {
            return false;
          }
          if (!dispatch) {
            return true;
          }

          const content = text.includes(BLOCK_SEPARATOR)
            ? state.schema.nodes[CODE_BLOCK_NODE_TYPE].create(
              { language: undefined },
              state.schema.text(text),
            )
            : state.schema.text(text, [state.schema.marks[CODE_MARK_TYPE].create()]);
          const replacementRange = text.includes(BLOCK_SEPARATOR)
            ? expandSelectedTextblockEdges(state.doc, range)
            : range;
          if (replacementRange.from !== range.from && replacementRange.to !== range.to) {
            tr.replaceWith(replacementRange.from, replacementRange.to, content);
          } else {
            tr.replaceRangeWith(replacementRange.from, replacementRange.to, content);
          }
          restoreMappedSelection(tr, range);
          return true;
        },
        toggleSelectionBlockquote: () => ({ state, tr, dispatch }) => {
          const range = { from: state.selection.from, to: state.selection.to };
          const shouldRemove = shouldRemoveSelectedBlockquote(
            state.doc,
            range,
            getIsRichInputExpanded(),
          );
          if (!dispatch) {
            return true;
          }

          if (shouldRemove) {
            removeSelectedBlockquotes(tr, range);
          } else {
            wrapSelectionInBlockquote(tr, splitSelectionBoundaries(tr, range));
          }
          restoreMappedSelection(tr, range);
          return true;
        },
        setFormatterSelectionHighlight: (isVisible: boolean) => ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(FORMATTER_SELECTION_HIGHLIGHT_KEY, isVisible);
          }
          return true;
        },
      };
    },

    addKeyboardShortcuts() {
      const handleClearFormatting = () => {
        const { state, view } = this.editor;
        const {
          doc, schema, selection, storedMarks,
        } = state;
        if (selection.empty) {
          const activeMarks = storedMarks || selection.$from.marks();
          if (!activeMarks.length) {
            return false;
          }

          view.dispatch(state.tr.setStoredMarks([]));
          return true;
        }

        const hasSelectedMarks = Object.values(schema.marks)
          .some((mark) => doc.rangeHasMark(selection.from, selection.to, mark));
        if (!hasSelectedMarks) {
          return false;
        }

        return this.editor.commands.unsetAllMarks({ ignoreClearable: true });
      };

      return {
        'Mod-n': handleClearFormatting,
        'Mod-N': handleClearFormatting,
      };
    },

    addProseMirrorPlugins() {
      const { editor } = this;

      return [new Plugin<boolean>({
        key: FORMATTER_SELECTION_HIGHLIGHT_KEY,
        state: {
          init: () => false,
          apply: (transaction, isVisible) => (
            transaction.getMeta(FORMATTER_SELECTION_HIGHLIGHT_KEY) ?? isVisible
          ),
        },
        props: {
          decorations: (state) => {
            if (!FORMATTER_SELECTION_HIGHLIGHT_KEY.getState(state) || editor.isFocused || state.selection.empty) {
              return undefined;
            }

            return DecorationSet.create(state.doc, [Decoration.inline(state.selection.from, state.selection.to, {
              class: styles.selectionHighlight,
            })]);
          },
        },
      })];
    },
  });
}

export function isRichEditorBlockquoteActive(
  editor: Editor,
  range: EditorRange,
  isRichInputExpanded: boolean,
) {
  return shouldRemoveSelectedBlockquote(editor.state.doc, range, isRichInputExpanded);
}

function getSelectedNodes(doc: ProseMirrorNode, range: EditorRange, nodeTypeName: string) {
  const nodes: SelectedNode[] = [];
  doc.nodesBetween(range.from, range.to, (node, position) => {
    if (node.type.name === nodeTypeName) {
      nodes.push({ node, position });
    }
  });
  return nodes;
}

function expandSelectedTextblockEdges(doc: ProseMirrorNode, range: EditorRange): EditorRange {
  const $from = doc.resolve(range.from);
  const $to = doc.resolve(range.to);
  return {
    from: $from.parentOffset ? range.from : $from.before($from.depth),
    to: $to.parentOffset < $to.parent.content.size ? range.to : $to.after($to.depth),
  };
}

function unwrapSelectedCodeBlocks(transaction: Transaction, codeBlocks: SelectedNode[]) {
  const { schema } = transaction.doc.type;
  codeBlocks.reverse().forEach(({ node, position }) => {
    const paragraphs = node.textContent.split(BLOCK_SEPARATOR).map((line) => (
      schema.nodes[PARAGRAPH_NODE_TYPE].create(undefined, line ? schema.text(line) : undefined)
    ));
    transaction.replaceWith(position, position + node.nodeSize, Fragment.fromArray(paragraphs));
  });
}

function shouldRemoveSelectedBlockquote(
  doc: ProseMirrorNode,
  range: EditorRange,
  isRichInputExpanded: boolean,
) {
  const blockquotes = getSelectedNodes(doc, range, BLOCKQUOTE_NODE_TYPE);
  if (!isRichInputExpanded && blockquotes.length) {
    return true;
  }
  if (blockquotes.some(({ node, position }) => isNodeFullySelected(node, position, range))) {
    return true;
  }

  const positions = [range.from, Math.max(range.from, range.to - 1)];
  const ancestorDepth = Math.min(...positions.map((position) => (
    getPositionAncestorTypeDepth(doc, position, BLOCKQUOTE_NODE_TYPE)
  )));
  return ancestorDepth > (isRichInputExpanded ? 1 : 0);
}

function isNodeFullySelected(node: ProseMirrorNode, position: number, range: EditorRange) {
  let start: number | undefined;
  let end: number | undefined;
  node.descendants((child, childPosition) => {
    if (child.isText) {
      start ??= position + 1 + childPosition;
      end = position + 1 + childPosition + child.nodeSize;
    }
    return !child.isText;
  });
  return start !== undefined && range.from <= start && range.to >= end!;
}

function getPositionAncestorTypeDepth(doc: ProseMirrorNode, position: number, nodeTypeName: string) {
  const $position = doc.resolve(position);
  let count = 0;
  for (let depth = $position.depth; depth > 0; depth--) {
    if ($position.node(depth).type.name === nodeTypeName) {
      count++;
    }
  }
  return count;
}

function splitSelectionBoundaries(transaction: Transaction, range: EditorRange) {
  const end = transaction.mapping.map(range.to, -1);
  if (canSplitTextblock(transaction, end)) {
    transaction.split(end);
  }
  const start = transaction.mapping.map(range.from, 1);
  if (canSplitTextblock(transaction, start)) {
    transaction.split(start);
  }
  return {
    from: transaction.mapping.map(range.from, 1),
    to: transaction.mapping.map(range.to, -1),
  };
}

function canSplitTextblock(transaction: Transaction, position: number) {
  const $position = transaction.doc.resolve(position);
  return $position.parent.isTextblock
    && $position.parentOffset > 0
    && $position.parentOffset < $position.parent.content.size
    && canSplit(transaction.doc, position);
}

function wrapSelectionInBlockquote(transaction: Transaction, range: EditorRange) {
  const nodeRange = transaction.doc.resolve(range.from).blockRange(transaction.doc.resolve(range.to));
  const wrapping = nodeRange && findWrapping(
    nodeRange,
    transaction.doc.type.schema.nodes[BLOCKQUOTE_NODE_TYPE],
  );
  if (nodeRange && wrapping) {
    transaction.wrap(nodeRange, wrapping);
  }
}

function removeSelectedBlockquotes(transaction: Transaction, range: EditorRange) {
  const blockquotes = getSelectedNodes(transaction.doc, range, BLOCKQUOTE_NODE_TYPE)
    .map(({ node, position }) => ({
      from: position,
      to: position + node.nodeSize,
    }));
  blockquotes.filter((blockquote) => !blockquotes.some((candidate) => (
    candidate.from > blockquote.from && candidate.to < blockquote.to
  ))).reverse().forEach(({ from }) => {
    unwrapRichEditorQuote(transaction, from);
  });
}

function restoreMappedSelection(transaction: Transaction, range: EditorRange) {
  if (!transaction.docChanged) {
    return;
  }

  const from = Math.min(transaction.mapping.map(range.from, 1), transaction.doc.content.size);
  const to = Math.min(transaction.mapping.map(range.to, -1), transaction.doc.content.size);
  transaction.setSelection(TextSelection.between(
    transaction.doc.resolve(Math.min(from, to)),
    transaction.doc.resolve(Math.max(from, to)),
  ));
}
