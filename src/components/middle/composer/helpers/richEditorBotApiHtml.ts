import { Extension } from '@tiptap/core';
import {
  DOMSerializer,
  Fragment,
  type Node as ProseMirrorNode,
  Slice,
} from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';

import {
  EMOJI_NODE_NAME,
  TABLE_CELL_HIGHLIGHT_ATTR,
  TABLE_WRAPPER_NODE_NAME,
} from '../../../../util/tiptap/constants';
import { preserveCopiedRichEditorTable } from './richEditorTable';

export const RichEditorBotApiHtml = Extension.create({
  name: 'richEditorBotApiHtml',

  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        clipboardSerializer: buildClipboardSerializer(this.editor.schema),
        clipboardTextSerializer: ({ content }) => serializePlainText(content),
        transformCopied: (slice, view) => replaceEmojiNodes(
          preserveCopiedRichEditorTable(slice, view.state.selection),
        ),
        transformPastedHTML: normalizeBotApiHtml,
      },
    })];
  },
});

function buildClipboardSerializer(schema: Parameters<typeof DOMSerializer.nodesFromSchema>[0]) {
  const nodes = { ...DOMSerializer.nodesFromSchema(schema) };
  const serializer = new DOMSerializer(nodes, DOMSerializer.marksFromSchema(schema));

  nodes.details = (node) => renderDetails(serializer, node);
  nodes[TABLE_WRAPPER_NODE_NAME] = (node) => buildTable(serializer, node.child(1), node.child(0));
  nodes.table = (node) => buildTable(serializer, node);
  nodes.tableRow = () => ['tr', 0];
  nodes.tableCell = (node) => renderTableCell(serializer, node);

  return serializer;
}

function replaceEmojiNodes(slice: Slice) {
  return new Slice(
    replaceEmojiNodesInFragment(slice.content),
    slice.openStart,
    slice.openEnd,
  );
}

function replaceEmojiNodesInFragment(fragment: Fragment) {
  const nodes: ProseMirrorNode[] = [];

  fragment.forEach((node) => {
    if (node.type.name === EMOJI_NODE_NAME) {
      nodes.push(node.type.schema.text(node.attrs.alt, node.marks));
      return;
    }

    nodes.push(node.copy(replaceEmojiNodesInFragment(node.content)));
  });

  return Fragment.fromArray(nodes);
}

function serializePlainText(fragment: Fragment, parent?: ProseMirrorNode) {
  const parts: string[] = [];

  fragment.forEach((node, _offset, index) => {
    if (node.isText) {
      parts.push(node.text!);
      return;
    }

    const serializer = node.type.spec.toText;
    if (serializer) {
      parts.push(serializer({
        node,
        pos: 0,
        parent: parent || node,
        index,
        range: { from: 0, to: node.nodeSize },
      }));
      return;
    }

    parts.push(serializePlainText(node.content, node));
  });

  if (parent?.type.spec.tableRole === 'row') {
    return parts.join('\t');
  }

  return parts.join(parent?.inlineContent ? '' : '\n');
}

function renderDetails(serializer: DOMSerializer, node: ProseMirrorNode) {
  const element = document.createElement('details');
  element.open = Boolean(node.attrs.open);
  element.append(serializer.serializeNode(node.child(0)));
  serializer.serializeFragment(node.child(1).content, {}, element);

  return element;
}

function buildTable(
  serializer: DOMSerializer,
  node: ProseMirrorNode,
  title?: ProseMirrorNode,
) {
  const element = document.createElement('table');
  element.toggleAttribute('bordered', node.attrs.isBordered !== false);
  element.toggleAttribute('striped', Boolean(node.attrs.isStriped));

  if (title?.content.size) {
    const caption = element.appendChild(document.createElement('caption'));
    serializer.serializeFragment(title.content, {}, caption);
  }

  const body = element.appendChild(document.createElement('tbody'));
  serializer.serializeFragment(node.content, {}, body);

  return element;
}

function renderTableCell(serializer: DOMSerializer, node: ProseMirrorNode) {
  const element = document.createElement(node.attrs[TABLE_CELL_HIGHLIGHT_ATTR] ? 'th' : 'td');

  if (node.attrs.colspan > 1) element.colSpan = node.attrs.colspan;
  if (node.attrs.rowspan > 1) element.rowSpan = node.attrs.rowspan;
  if (node.attrs.align) element.setAttribute('align', node.attrs.align);
  if (node.attrs.verticalAlign) element.setAttribute('valign', node.attrs.verticalAlign);

  node.forEach((paragraph, _offset, index) => {
    if (index) element.append(document.createElement('br'));
    serializer.serializeFragment(paragraph.content, {}, element);
  });

  return element;
}

function normalizeBotApiHtml(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('table').forEach(normalizeTable);
  template.content.querySelectorAll('details').forEach(normalizeDetails);

  return template.innerHTML;
}

function normalizeTable(table: HTMLTableElement) {
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-rich-editor-table', '');
  const title = document.createElement('div');
  title.setAttribute('data-rich-editor-table-title', '');
  const caption = table.querySelector(':scope > caption');
  if (caption) {
    title.append(...caption.childNodes);
    caption.remove();
  }

  table.replaceWith(wrapper);
  wrapper.append(title, table);
}

function normalizeDetails(details: HTMLDetailsElement) {
  const content = document.createElement('div');
  content.dataset.type = 'detailsContent';
  const summary = details.querySelector(':scope > summary');
  content.append(...details.childNodes);
  if (summary) {
    details.append(summary);
  }
  details.append(content);
}
