import type { Editor, JSONContent as TiptapJsonContent } from '@tiptap/core';

import type { ApiFormattedText, ApiInputRichMessage, ApiSticker } from '../../../../api/types';
import type { RichEditorInsertContent } from '../richEditorTypes';

import { getRichMessagePreviewText } from '../../../../global/helpers/richMessage';
import buildClassName from '../../../../util/buildClassName';
import { buildRichMessageFromFormatted, buildTiptapJsonFromRichMessage } from '../../../ui/textInput/richText';

import placeholderSrc from '../../../../assets/square.svg';

const EMPTY_TEXT = '';
const GRAPHEME_SEGMENTER = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : undefined;

export function getRichMessageText(value?: ApiInputRichMessage) {
  return value?.blocks.length ? getRichMessagePreviewText(value) : EMPTY_TEXT;
}

export function hasEditorCollapsedSelection(editor?: Editor) {
  return Boolean(editor?.state.selection.empty);
}

export function insertEditorContent(
  editor: Editor | undefined,
  content: RichEditorInsertContent | RichEditorInsertContent[],
  shouldPrepend = false,
) {
  if (!editor) {
    return;
  }

  const tiptapContent = buildTiptapContent(content);
  if (!tiptapContent) {
    return;
  }

  if (shouldPrepend) {
    editor.chain().focus('start').insertContent(tiptapContent).run();
    return;
  }

  editor.chain().focus().insertContent(tiptapContent).run();
}

export function replaceEditorRange(
  editor: Editor | undefined,
  range: { from: number; to: number },
  content: RichEditorInsertContent | RichEditorInsertContent[],
) {
  if (!editor) {
    return;
  }

  const tiptapContent = buildTiptapContent(content);
  if (!tiptapContent) {
    return;
  }

  const replaceRange = buildEditorReplaceRange(editor, range);

  editor.chain()
    .focus()
    .deleteRange(replaceRange)
    .insertContent(tiptapContent)
    .run();
}

export function deleteEditorCharacterBeforeSelection(editor: Editor | undefined) {
  if (!editor) {
    return;
  }

  const { $from, from, to } = editor.state.selection;
  if (from !== to) {
    editor.chain().focus().deleteSelection().run();
    return;
  }

  if (from <= 1) {
    return;
  }

  const previousNode = $from.nodeBefore;
  const deleteLength = previousNode?.text
    ? getPreviousGraphemeLength(previousNode.text)
    : previousNode?.nodeSize || 1;

  editor.chain().focus().deleteRange({ from: from - deleteLength, to: from }).run();
}

function buildMentionContent(
  userId: string | undefined,
  username: string | undefined,
  text: string,
): TiptapJsonContent {
  return {
    type: 'mention',
    attrs: {
      userId,
      username,
      label: text,
    },
    content: text ? [{
      type: 'text',
      text,
    }] : undefined,
  };
}

function buildEditorReplaceRange(editor: Editor, range: { from: number; to: number }) {
  let replaceRange = range;
  const { doc } = editor.state;
  const from = Math.max(0, range.from - 1);
  const to = Math.min(doc.content.size, range.to + 1);

  doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== 'mention') {
      return;
    }

    const nodeTo = pos + node.nodeSize;
    if (range.from >= pos && range.to <= nodeTo) {
      replaceRange = { from: pos, to: nodeTo };
      return false;
    }

    return undefined;
  });

  return replaceRange;
}

function buildCustomEmojiTiptapNode(emoji: ApiSticker): TiptapJsonContent {
  const className = buildClassName(
    'custom-emoji',
    'emoji',
    'emoji-small',
    'placeholder',
    emoji.shouldUseTextColor && 'colorable',
  );

  return {
    type: 'customEmoji',
    attrs: {
      className,
      alt: emoji.emoji || EMPTY_TEXT,
      documentId: emoji.id,
      src: placeholderSrc,
    },
  };
}

function buildTiptapContentFromFormattedText(text: ApiFormattedText) {
  const richMessage = buildRichMessageFromFormatted(text);
  const content = buildTiptapJsonFromRichMessage(richMessage).content || [];
  const block = content[0];
  if (content.length === 1 && block.type === 'paragraph') {
    return block.content || [];
  }

  return content;
}

function buildTiptapContent(content: RichEditorInsertContent | RichEditorInsertContent[]) {
  const result = (Array.isArray(content) ? content : [content]).flatMap(buildTiptapContentPart);

  return result.length ? result : undefined;
}

function buildTiptapContentPart(content: RichEditorInsertContent): TiptapJsonContent[] {
  switch (content.type) {
    case 'text':
      return content.text ? [{ type: 'text', text: content.text }] : [];
    case 'formattedText':
      return content.text.text ? buildTiptapContentFromFormattedText(content.text) : [];
    case 'customEmoji':
      return [buildCustomEmojiTiptapNode(content.emoji)];
    case 'mention':
      return [buildMentionContent(content.userId, content.username, content.text)];
    default:
      return [];
  }
}

function getPreviousGraphemeLength(text: string) {
  const previousGrapheme = GRAPHEME_SEGMENTER?.segment(text).containing(text.length - 1);

  return previousGrapheme?.segment.length || Array.from(text).at(-1)!.length;
}
