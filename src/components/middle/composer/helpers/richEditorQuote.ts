import { type Editor, findParentNode } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type {
  EditorState, Selection, Transaction,
} from '@tiptap/pm/state';
import { Selection as ProseMirrorSelection, TextSelection } from '@tiptap/pm/state';

import { CAPTION_NODE_NAME } from '../../../../util/tiptap/constants';

type QuoteContext = {
  node: ProseMirrorNode;
  pos: number;
  bodyEnd: number;
};

export type RichEditorQuoteHtmlAttributes = {
  class?: string;
};

export function isRichEditorQuoteNode(node: ProseMirrorNode) {
  return node.type.name === 'blockquote' || node.type.name === 'pullquote';
}

export function isSelectionInsideRichEditorQuote(selection: Selection, typeName?: string) {
  return Boolean(findQuote(selection, typeName));
}

export function unwrapRichEditorQuote(transaction: Transaction, pos: number) {
  const node = transaction.doc.nodeAt(pos);
  if (!node || !isRichEditorQuoteNode(node)) return false;

  const body = getQuoteBody(node);
  const $quote = transaction.doc.resolve(pos);
  const index = $quote.index();
  if (!$quote.parent.canReplace(index, index + 1, body)) return false;

  transaction.replaceWith(pos, pos + node.nodeSize, body);
  return true;
}

export function unsetRichEditorQuote(
  state: EditorState,
  dispatch: ((transaction: Transaction) => void) | undefined,
  typeName: string,
) {
  const quote = findQuote(state.selection, typeName);
  if (!quote) return false;

  const transaction = state.tr;
  if (!unwrapRichEditorQuote(transaction, quote.pos)) return false;

  setSelectionNear(transaction, quote.pos, 1);
  dispatch?.(transaction.scrollIntoView());
  return true;
}

export function handleRichEditorQuoteBackspace(editor: Editor, typeName: string) {
  const { selection } = editor.state;
  if (!selection.empty || selection.$from.parentOffset) return false;

  const quote = findQuote(selection, typeName);
  if (!quote) return mergeIntoPreviousQuote(editor, typeName);
  if (selection.$from.parent.type.name === CAPTION_NODE_NAME) {
    return moveToBodyEnd(editor, quote);
  }

  if (findTextSelection(editor.state.doc, quote.pos + 1, 1)?.from !== selection.from) {
    return false;
  }

  const transaction = editor.state.tr;
  if (!unwrapRichEditorQuote(transaction, quote.pos)) return false;

  setSelectionNear(transaction, quote.pos, 1);
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

export function handleRichEditorQuoteArrow(
  editor: Editor,
  typeName: string,
  direction: -1 | 1,
) {
  const { selection } = editor.state;
  if (!selection.empty) return false;

  const quote = findQuote(selection, typeName);
  if (!quote) return false;

  const isCaption = selection.$from.parent.type.name === CAPTION_NODE_NAME;
  if (direction < 0) {
    if (isCaption && !selection.$from.parentOffset) return moveToBodyEnd(editor, quote);

    return findTextSelection(editor.state.doc, quote.pos + 1, 1)?.from === selection.from
      ? moveOutsideQuote(editor, quote, direction)
      : false;
  }

  if (isCaption) {
    return selection.$from.parentOffset === selection.$from.parent.content.size
      ? moveOutsideQuote(editor, quote, direction)
      : false;
  }

  if (findTextSelection(editor.state.doc, quote.bodyEnd, -1)?.from !== selection.from) {
    return false;
  }

  return getQuoteCaption(quote.node)
    ? editor.commands.setTextSelection(quote.bodyEnd + 1)
    : moveOutsideQuote(editor, quote, direction);
}

export function handleRichEditorQuoteEnter(editor: Editor, typeName: string) {
  const { selection } = editor.state;
  if (
    !selection.empty
    || selection.$from.parent.type.name !== CAPTION_NODE_NAME
  ) {
    return false;
  }

  const quote = findQuote(selection, typeName);
  if (!quote) return false;

  const $quote = editor.state.doc.resolve(quote.pos);
  const insertPos = quote.pos + quote.node.nodeSize;
  if ($quote.parent.maybeChild($quote.index() + 1)?.type === editor.schema.nodes.paragraph) {
    return editor.commands.setTextSelection(insertPos + 1);
  }

  return insertParagraphOutsideQuote(editor, quote, 1);
}

function findQuote(selection: Selection, typeName?: string): QuoteContext | undefined {
  const result = findParentNode((node) => (
    isRichEditorQuoteNode(node) && (!typeName || node.type.name === typeName)
  ))(selection);
  if (!result) return undefined;

  return buildQuote(result.node, result.pos);
}

function getQuoteCaption(node: ProseMirrorNode) {
  return node.lastChild?.type.name === CAPTION_NODE_NAME ? node.lastChild : undefined;
}

function getQuoteBody(node: ProseMirrorNode) {
  const caption = getQuoteCaption(node);
  return caption ? node.content.cut(0, node.content.size - caption.nodeSize) : node.content;
}

function moveToBodyEnd(editor: Editor, quote: QuoteContext) {
  const selection = findTextSelection(editor.state.doc, quote.bodyEnd, -1);
  if (!selection) return false;

  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
  return true;
}

function moveOutsideQuote(editor: Editor, quote: QuoteContext, direction: -1 | 1) {
  const $quote = editor.state.doc.resolve(quote.pos);
  const adjacent = $quote.parent.maybeChild($quote.index() + direction);
  if (adjacent && adjacent.type.name !== CAPTION_NODE_NAME) {
    const boundary = direction < 0 ? quote.pos : quote.pos + quote.node.nodeSize;
    const selection = findTextSelection(editor.state.doc, boundary, direction);
    if (selection && selection.from >= $quote.start() && selection.to <= $quote.end()) {
      editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
      return true;
    }
  }

  return insertParagraphOutsideQuote(editor, quote, direction);
}

function insertParagraphOutsideQuote(editor: Editor, quote: QuoteContext, direction: -1 | 1) {
  const paragraphType = editor.schema.nodes.paragraph;
  const $quote = editor.state.doc.resolve(quote.pos);
  const insertIndex = $quote.index() + (direction > 0 ? 1 : 0);
  if (!$quote.parent.canReplaceWith(insertIndex, insertIndex, paragraphType)) return false;

  const insertPos = direction < 0 ? quote.pos : quote.pos + quote.node.nodeSize;
  const transaction = editor.state.tr.insert(insertPos, paragraphType.create());
  transaction.setSelection(TextSelection.create(transaction.doc, insertPos + 1));
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

function mergeIntoPreviousQuote(editor: Editor, typeName: string) {
  const { $from } = editor.state.selection;
  const parentDepth = $from.depth - 1;
  if (parentDepth < 0) return false;

  const parent = $from.node(parentDepth);
  const index = $from.index(parentDepth);
  const previous = index ? parent.child(index - 1) : undefined;
  if (previous?.type.name !== typeName || !getQuoteBody(previous).lastChild?.isTextblock) {
    return false;
  }

  const blockStart = $from.before();
  const quote = buildQuote(previous, blockStart - previous.nodeSize);
  const targetSelection = findTextSelection(editor.state.doc, quote.bodyEnd, -1);
  if (!targetSelection) return true;

  const content = $from.parent.content;
  if (!targetSelection.$from.parent.canReplace(
    targetSelection.$from.parent.childCount,
    targetSelection.$from.parent.childCount,
    content,
  )) {
    return true;
  }

  const transaction = editor.state.tr
    .delete(blockStart, $from.after())
    .insert(targetSelection.from, content);
  transaction.setSelection(TextSelection.create(transaction.doc, targetSelection.from));
  editor.view.dispatch(transaction.scrollIntoView());
  return true;
}

function buildQuote(node: ProseMirrorNode, pos: number): QuoteContext {
  const caption = getQuoteCaption(node);
  return {
    node,
    pos,
    bodyEnd: pos + 1 + node.content.size - (caption?.nodeSize || 0),
  };
}

function findTextSelection(doc: ProseMirrorNode, pos: number, direction: -1 | 1) {
  const selection = ProseMirrorSelection.findFrom(doc.resolve(pos), direction, true);
  return selection instanceof TextSelection ? selection : undefined;
}

function setSelectionNear(transaction: Transaction, pos: number, direction: -1 | 1) {
  const selection = findTextSelection(transaction.doc, pos, direction);
  if (selection) transaction.setSelection(selection);
}
