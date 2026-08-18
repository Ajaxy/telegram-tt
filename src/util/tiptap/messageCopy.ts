import {
  generateJSON,
  getSchema,
  type JSONContent as TiptapJsonContent,
} from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

import type { ClipboardTextContent } from '../../types/messageCopy';

import { __buildRichEditorSchemaExtensions } from '../../components/middle/composer/helpers/richEditor';
import {
  buildBotApiHtmlSerializer,
  extendBotApiMarkdownHtml,
  normalizeRenderedRichContentHtml,
  serializeTiptapPlainText,
} from './botApiHtml';

const MESSAGE_COPY_EXTENSIONS = __buildRichEditorSchemaExtensions();
const MESSAGE_COPY_SCHEMA = getSchema(MESSAGE_COPY_EXTENSIONS);
const MESSAGE_COPY_HTML_SERIALIZER = buildBotApiHtmlSerializer(MESSAGE_COPY_SCHEMA);
const MESSAGE_COPY_MARKDOWN_MANAGER = new MarkdownManager({
  extensions: extendBotApiMarkdownHtml(
    MESSAGE_COPY_EXTENSIONS,
    MESSAGE_COPY_SCHEMA,
    MESSAGE_COPY_HTML_SERIALIZER,
  ),
});

export function parseMessageCopyHtml(html: string) {
  return normalizeMessageCopyJson(generateJSON(
    normalizeRenderedRichContentHtml(html),
    MESSAGE_COPY_EXTENSIONS,
  ));
}

export function serializeMessageCopyTiptapJson(doc: TiptapJsonContent): ClipboardTextContent {
  const normalizedDoc = normalizeMessageCopyJson(doc);
  const proseMirrorDoc = ProseMirrorNode.fromJSON(MESSAGE_COPY_SCHEMA, normalizedDoc);
  const container = document.createElement('div');
  MESSAGE_COPY_HTML_SERIALIZER.serializeFragment(proseMirrorDoc.content, {}, container);

  return {
    plainText: serializeTiptapPlainText(proseMirrorDoc.content),
    html: container.innerHTML,
    markdown: MESSAGE_COPY_MARKDOWN_MANAGER.serialize(normalizedDoc),
  };
}

function normalizeMessageCopyJson(node: TiptapJsonContent): TiptapJsonContent {
  if (node.type === 'emoji') {
    return {
      type: 'text',
      text: String(node.attrs?.emoji || node.attrs?.alt || '\u{FFFC}'),
      marks: node.marks,
    };
  }

  return {
    ...node,
    content: node.content?.map(normalizeMessageCopyJson),
  };
}
