import {
  type AnyExtension,
  type Extensions,
  getExtensionField,
  type JSONContent as TiptapJsonContent,
} from '@tiptap/core';
import {
  DOMSerializer,
  type Fragment,
  Node as ProseMirrorNode,
} from '@tiptap/pm/model';

import type { ApiPageCaption, ApiRichText } from '../../api/types';
import { ApiMessageEntityTypes } from '../../api/types';

import { TME_LINK_PREFIX } from '../../config';
import { getRichTextPlainText } from '../../global/helpers/richMessage';
import { getFormattedDateFormatString } from '../dates/formattedDate';
import {
  buildButtonAttrs,
  buildButtonHtmlAttrs,
  BUTTON_ROW_NODE_NAME,
  normalizeButtonHtml,
  RICH_BUTTON_NODE_NAME,
} from './extensions/richButton';
import {
  BLOCKQUOTE_COLLAPSED_ATTR,
  CAPTION_NODE_NAME,
  FOOTER_NODE_NAME,
  MATH_BLOCK_NODE_NAME,
  MATH_INLINE_NODE_NAME,
  MEDIA_NODE_NAME,
  TABLE_CELL_HIGHLIGHT_ATTR,
  TABLE_TITLE_NODE_NAME,
  TABLE_WRAPPER_NODE_NAME,
} from './constants';
import {
  EMPTY_RICH_MEDIA_CAPTION,
  getRichEditorMediaAttrs,
  getRichMediaRef,
  isApiRichText,
  isRichMediaKind,
  parseRichMediaRef,
  registerRichEditorMediaAttrs,
  registerRichMedia,
  resolveRichMediaRef,
  type RichEditorMediaAttrs,
  type RichEditorMediaItem,
} from './richMedia';

type Schema = Parameters<typeof DOMSerializer.nodesFromSchema>[0];
type RenderMarkdown = NonNullable<AnyExtension['config']['renderMarkdown']>;

const ORDERED_LIST_REVERSED_ATTR = 'reversed';
const CODE_LANGUAGE_CLASS_PREFIX = 'language-';
const MAX_RICH_MEDIA_COPY_ITEMS = 100;
const RE_WEB_PAGE_ID = /^-?\d+$/;

export function buildBotApiHtmlSerializer(schema: Schema) {
  const nodes = { ...DOMSerializer.nodesFromSchema(schema) };
  const marks = { ...DOMSerializer.marksFromSchema(schema) };

  nodes[RICH_BUTTON_NODE_NAME] = (node) => ['tg-button', buildButtonHtmlAttrs(node.attrs), 0];
  nodes[BUTTON_ROW_NODE_NAME] = (node) => ['tg-button-row', node.attrs.align ? { align: node.attrs.align } : {}, 0];
  nodes.paragraph = () => ['p', 0];
  nodes.heading = (node) => [`h${node.attrs.level}`, 0];
  nodes.horizontalRule = () => ['hr'];
  nodes.hardBreak = () => ['br'];
  nodes.blockquote = (node) => [
    'blockquote',
    node.attrs[BLOCKQUOTE_COLLAPSED_ATTR] ? { expandable: '' } : {},
    0,
  ];
  nodes.pullquote = (node) => renderPullquote(serializer, node);
  nodes[CAPTION_NODE_NAME] = () => ['cite', 0];
  nodes[FOOTER_NODE_NAME] = () => ['footer', 0];
  nodes.bulletList = () => ['ul', 0];
  nodes.orderedList = (node) => ['ol', buildOrderedListAttributes(node), 0];
  nodes.listItem = (node) => renderListItem(serializer, node);
  nodes.codeBlock = (node) => [
    'pre',
    ['code', node.attrs.language ? { class: `${CODE_LANGUAGE_CLASS_PREFIX}${node.attrs.language}` } : {}, 0],
  ];
  nodes.emoji = (node) => node.attrs.emoji || node.attrs.alt || '';
  nodes.customEmoji = (node) => ['tg-emoji', { 'emoji-id': String(node.attrs.documentId) }, node.attrs.alt || ''];
  nodes.formattedDate = (node) => ['tg-time', {
    unix: String(node.attrs.date),
    format: getFormattedDateFormatString(node.attrs),
  }, node.attrs.label || ''];
  nodes.mention = (node) => ['a', { href: buildMentionHref(node) }, 0];
  nodes[MATH_BLOCK_NODE_NAME] = (node) => ['tg-math-block', String(node.attrs.source || '')];
  nodes[MATH_INLINE_NODE_NAME] = (node) => ['tg-math', String(node.attrs.source || '')];
  nodes.details = (node) => renderDetails(serializer, node);
  nodes.detailsSummary = () => ['summary', 0];
  nodes.detailsContent = () => ['div', 0];
  nodes[TABLE_WRAPPER_NODE_NAME] = (node) => buildTable(serializer, node.child(1), node.child(0));
  nodes[TABLE_TITLE_NODE_NAME] = () => ['caption', 0];
  nodes.table = (node) => buildTable(serializer, node);
  nodes.tableRow = () => ['tr', 0];
  nodes.tableCell = (node) => renderTableCell(serializer, node);
  nodes[MEDIA_NODE_NAME] = (node) => renderMedia(serializer, node);

  marks.bold = () => ['strong', 0];
  marks.italic = () => ['em', 0];
  marks.underline = () => ['u', 0];
  marks.strike = () => ['del', 0];
  marks.code = () => ['code', 0];
  marks.link = (mark) => ['a', { href: mark.attrs.href }, 0];
  marks.spoiler = () => ['tg-spoiler', 0];
  marks.marked = () => ['mark', 0];
  marks.subscript = () => ['sub', 0];
  marks.superscript = () => ['sup', 0];
  marks.date = (mark) => ['tg-time', { unix: String(mark.attrs.date) }, 0];

  const serializer = new DOMSerializer(nodes, marks);
  return serializer;
}

export function extendBotApiMarkdownHtml(
  extensions: Extensions,
  schema: Schema,
  serializer: DOMSerializer,
): Extensions {
  return extensions.map((extension) => extendBotApiMarkdownHtmlExtension(extension, schema, serializer));
}

export function normalizeBotApiHtml(html: string) {
  return normalizeHtml(html, false);
}

export function normalizeRenderedRichContentHtml(html: string) {
  return normalizeHtml(html, true);
}

function extendBotApiMarkdownHtmlExtension(
  extension: AnyExtension,
  schema: Schema,
  serializer: DOMSerializer,
) {
  const renderMarkdown = getExtensionField<RenderMarkdown>(extension, 'renderMarkdown');

  switch (extension.name) {
    case 'blockquote':
      return extension.extend({
        renderMarkdown(node, helpers, context) {
          const hasCaption = node.content?.at(-1)?.type === CAPTION_NODE_NAME;
          return hasCaption || node.attrs?.[BLOCKQUOTE_COLLAPSED_ATTR]
            ? serializeBotApiHtmlNode(node, schema, serializer)
            : renderMarkdown?.(node, helpers, context) || '';
        },
      });
    case 'orderedList':
      return extension.extend({
        renderMarkdown(node, helpers, context) {
          return node.attrs?.type || node.attrs?.[ORDERED_LIST_REVERSED_ATTR]
            ? serializeBotApiHtmlNode(node, schema, serializer)
            : renderMarkdown?.(node, helpers, context) || '';
        },
      });
    case RICH_BUTTON_NODE_NAME:
    case BUTTON_ROW_NODE_NAME:
    case 'pullquote':
    case 'details':
    case FOOTER_NODE_NAME:
      return extension.extend({
        renderMarkdown(node) {
          return serializeBotApiHtmlNode(node, schema, serializer);
        },
      });
    case MEDIA_NODE_NAME:
      return extension.extend({
        renderMarkdown(node) {
          const attrs = getRichEditorMediaAttrs(node);
          const standaloneMarkdown = attrs && buildStandaloneMediaMarkdown(node, attrs);
          if (standaloneMarkdown !== undefined) return standaloneMarkdown;

          return serializeBotApiHtmlNode(node, schema, serializer);
        },
      });
    case TABLE_WRAPPER_NODE_NAME:
      return extension.extend({
        renderMarkdown(node, helpers) {
          const [title, table] = node.content || [];
          if (!table) return '';

          const titleMarkdown = title ? helpers.renderChildren(title).trim() : '';
          const tableMarkdown = helpers.renderChildren([table]);
          return titleMarkdown ? `${titleMarkdown}\n${tableMarkdown}` : tableMarkdown;
        },
      });
    default:
      return extension;
  }
}

function buildStandaloneMediaMarkdown(node: TiptapJsonContent, attrs: RichEditorMediaAttrs) {
  if (attrs.kind === 'document' || attrs.kind === 'audio'
    || attrs.items.length !== 1 || attrs.credit.type !== 'empty') return undefined;

  const item = attrs.items[0];
  if (
    !item.media
    || item.caption.text.type !== 'empty'
    || item.caption.credit.type !== 'empty'
    || item.isSpoiler
    || item.url
    || item.webPageId
    || item.isAutoplay
    || item.isLoop
  ) {
    return undefined;
  }

  const caption = buildPlainMediaCaption(node.content);
  if (caption === undefined) return undefined;

  registerRichMedia(item.media);
  const source = getRichMediaRef(item.type, item.media.id!);
  const title = caption ? ` "${escapeMarkdownMediaTitle(caption)}"` : '';
  return `![](${source}${title})`;
}

function buildPlainMediaCaption(content?: TiptapJsonContent[]) {
  if (!content?.length) return '';

  let result = '';
  for (const node of content) {
    if (node.type !== 'text' || node.marks?.length || typeof node.text !== 'string' || node.text.includes('\n')) {
      return undefined;
    }
    result += node.text;
  }
  return result;
}

function escapeMarkdownMediaTitle(value: string) {
  return value.replace(/[\\"]/g, '\\$&');
}

function serializeBotApiHtmlNode(
  node: TiptapJsonContent,
  schema: Schema,
  serializer: DOMSerializer,
) {
  const proseMirrorNode = ProseMirrorNode.fromJSON(schema, node);
  const container = document.createElement('div');
  container.append(serializer.serializeNode(proseMirrorNode));
  return container.innerHTML;
}

function buildOrderedListAttributes(node: ProseMirrorNode) {
  return {
    start: node.attrs.start !== 1 ? node.attrs.start : undefined,
    type: node.attrs.type || undefined,
    reversed: node.attrs.reversed ? '' : undefined,
  };
}

function buildMentionHref(node: ProseMirrorNode) {
  return node.attrs.userId
    ? `tg://user?id=${node.attrs.userId}`
    : `${TME_LINK_PREFIX}${node.attrs.username}`;
}

export function serializeTiptapPlainText(fragment: Fragment, parent?: ProseMirrorNode): string {
  const nestedListType = fragment.content[1]?.type.name;
  const hasStructuralListParagraph = parent?.type.name === 'listItem'
    && fragment.content[0]?.type.name === 'paragraph'
    && !fragment.content[0].content.size
    && (nestedListType === 'bulletList' || nestedListType === 'orderedList');
  const nodes = hasStructuralListParagraph ? fragment.content.slice(1) : fragment.content;
  const parts = nodes.map((node, index) => {
    if (node.isText) return node.text!;
    const serializer = node.type.spec.toText;
    return serializer
      ? serializer({
        node,
        pos: 0,
        parent: parent || node,
        index,
        range: { from: 0, to: node.nodeSize },
      })
      : serializeTiptapPlainText(node.content, node);
  });

  return parts.join(parent?.type.spec.tableRole === 'row' ? '\t' : parent?.inlineContent ? '' : '\n');
}

function renderPullquote(serializer: DOMSerializer, node: ProseMirrorNode) {
  const element = document.createElement('aside');
  let hasBody = false;

  node.forEach((child) => {
    if (child.type.name === CAPTION_NODE_NAME) {
      element.append(serializer.serializeNode(child));
      return;
    }

    if (hasBody) element.append(document.createElement('br'));
    serializer.serializeFragment(child.content, {}, element);
    hasBody = true;
  });

  return element;
}

function renderDetails(serializer: DOMSerializer, node: ProseMirrorNode) {
  const element = document.createElement('details');
  element.open = Boolean(node.attrs.open);
  element.append(serializer.serializeNode(node.child(0)));
  serializer.serializeFragment(node.child(1).content, {}, element);

  return element;
}

function renderListItem(serializer: DOMSerializer, node: ProseMirrorNode) {
  const element = document.createElement('li');
  if (node.attrs.checkbox) {
    const input = element.appendChild(document.createElement('input'));
    input.type = 'checkbox';
    input.toggleAttribute('checked', Boolean(node.attrs.checked));
  }
  serializer.serializeFragment(node.content, {}, element);
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
  element.toggleAttribute('compact', Boolean(node.attrs.isCompact));

  if (title?.content.size) {
    const caption = element.appendChild(document.createElement('caption'));
    serializer.serializeFragment(title.content, {}, caption);
  }

  serializer.serializeFragment(node.content, {}, element);

  return element;
}

function normalizeHtml(html: string, isRenderedRichContent: boolean) {
  const template = document.createElement('template');
  // Template content stays inert until ProseMirror parses it against the editor schema
  template.innerHTML = html;
  sanitizePastedRichEditorMedia(template.content);
  if (isRenderedRichContent) normalizeRenderedRichContent(template.content);
  normalizeBotApiHtmlForTiptap(template.content);
  return template.innerHTML;
}

function sanitizePastedRichEditorMedia(root: DocumentFragment) {
  root.querySelectorAll<HTMLElement>(
    '[data-rich-editor-media], [data-rich-editor-media-attrs], [data-rich-editor-media-id]',
  )
    .forEach((element) => {
      element.removeAttribute('data-rich-editor-media');
      element.removeAttribute('data-rich-editor-media-attrs');
      element.removeAttribute('data-rich-editor-media-id');
    });
}

function normalizeRenderedRichContent(root: DocumentFragment) {
  root.querySelectorAll<HTMLElement>('[data-tg-rich-media]').forEach(normalizeRenderedRichMedia);
  root.querySelectorAll<HTMLElement>('[data-rich-button]').forEach((element) => {
    try {
      const { action, style } = JSON.parse(element.dataset.richButton!);
      const replacement = replaceElement(element, 'tg-button');
      Object.entries(buildButtonHtmlAttrs(buildButtonAttrs(action, style))).forEach(([name, value]) => {
        replacement.setAttribute(name, value);
      });
    } catch {
      element.remove();
    }
  });
  root.querySelectorAll<HTMLElement>('[data-rich-button-row]').forEach((element) => {
    const align = element.dataset.richButtonRow;
    const replacement = replaceElement(element, 'tg-button-row');
    if (align) replacement.setAttribute('align', align);
  });
  root.querySelectorAll<HTMLElement>('[data-document-id]').forEach(normalizeCustomEmoji);
  root.querySelectorAll<HTMLPreElement>(`pre[data-entity-type="${ApiMessageEntityTypes.Pre}"]`)
    .forEach(normalizeRenderedCodeBlock);
  root.querySelectorAll<HTMLElement>('[data-rich-text-type="math"]').forEach((element) => {
    replaceElement(element, 'tg-math', element.dataset.source || '');
  });
  root.querySelectorAll<HTMLElement>('[data-unix]').forEach((element) => {
    const replacement = replaceElement(element, 'tg-time');
    replacement.setAttribute('unix', element.dataset.unix!);
    if (element.dataset.format) replacement.setAttribute('format', element.dataset.format);
  });
  root.querySelectorAll<HTMLElement>(`[data-entity-type="${ApiMessageEntityTypes.Spoiler}"]`)
    .forEach((element) => replaceElement(element, 'tg-spoiler'));
  root.querySelectorAll<HTMLAnchorElement>('[data-user-id]').forEach((element) => {
    element.href = `tg://user?id=${element.dataset.userId}`;
  });
  root.querySelectorAll<HTMLTableElement>('table').forEach(normalizeRenderedTable);
  root.querySelectorAll<HTMLElement>('[data-rich-block-type]').forEach(normalizeRenderedBlock);
  root.querySelectorAll(
    '[data-rich-copy-ignore], script, style, canvas, video, audio, button, svg, [aria-hidden="true"]',
  )
    .forEach((element) => {
      const isRebuiltMedia = element.matches('video, audio') && element.closest('[data-rich-copy-media]');
      if (!isRebuiltMedia) element.remove();
    });
  root.querySelectorAll<HTMLElement>('[data-rich-copy-wrapper]').forEach(unwrapElement);
  root.querySelectorAll<HTMLImageElement>('img').forEach((element) => {
    if (!element.closest('[data-rich-copy-media]')) element.replaceWith(element.alt || '');
  });
  root.querySelectorAll<HTMLElement>('[data-rich-copy-media]').forEach((element) => {
    element.removeAttribute('data-rich-copy-media');
  });
}

type RenderedRichMediaCopyData = Omit<RichEditorMediaAttrs, 'items'> & {
  items: Array<Omit<RichEditorMediaItem, 'media' | 'uploadId'> & { ref: string }>;
};

function normalizeRenderedRichMedia(element: HTMLElement) {
  const data = parseRenderedRichMediaCopyData(element.dataset.tgRichMedia);
  if (!data) return;

  const isGroup = data.items.length > 1;
  const replacement = document.createElement(isGroup
    ? (data.kind === 'slideshow' ? 'tg-slideshow' : 'tg-collage')
    : 'figure');
  replacement.setAttribute('data-rich-copy-media', '');
  data.items.forEach((item) => replacement.append(buildMediaElement(item, item.ref)));

  const caption = element.querySelector<HTMLElement>(data.kind === 'slideshow'
    ? ':scope > figcaption[data-rich-media-block-caption]' : ':scope > figcaption');
  if (caption) {
    caption.removeAttribute('data-rich-block-type');
    caption.querySelector<HTMLElement>(':scope > [data-rich-block-type="mediaCredit"]')?.remove();
    caption.dataset.tgSharedCaption = '';
    appendStoredCredit(caption, data.credit);
    replacement.append(caption);
  }
  element.replaceWith(replacement);
}

function parseRenderedRichMediaCopyData(value?: string): RenderedRichMediaCopyData | undefined {
  if (!value) return undefined;

  try {
    const data = JSON.parse(value) as Partial<RenderedRichMediaCopyData>;
    if (
      !data
      || !isRichMediaKind(data.kind)
      || !Array.isArray(data.items)
      || !data.items.length
      || data.items.length > MAX_RICH_MEDIA_COPY_ITEMS
      || !isApiRichText(data.credit)
    ) {
      return undefined;
    }

    const items = data.items.filter((item) => {
      const ref = item && parseRichMediaRef(item.ref);
      return ref?.type === item?.type
        && isApiRichText(item.caption?.text)
        && isApiRichText(item.caption?.credit)
        && (item.isSpoiler === undefined || item.isSpoiler === true)
        && (item.url === undefined || typeof item.url === 'string')
        && (item.webPageId === undefined || (
          typeof item.webPageId === 'string' && RE_WEB_PAGE_ID.test(item.webPageId)
        ))
        && (item.isAutoplay === undefined || item.isAutoplay === true)
        && (item.isLoop === undefined || item.isLoop === true);
    });
    return items.length === data.items.length ? { kind: data.kind, items, credit: data.credit } : undefined;
  } catch {
    return undefined;
  }
}

function normalizeRenderedCodeBlock(element: HTMLPreElement) {
  const renderedCode = element.querySelector<HTMLElement>(':scope > code');
  const code = renderedCode || document.createElement('code');
  if (!renderedCode) code.textContent = element.textContent;

  code.className = element.dataset.language ? `${CODE_LANGUAGE_CLASS_PREFIX}${element.dataset.language}` : '';
  element.replaceChildren(code);
}

function normalizeBotApiHtmlForTiptap(root: DocumentFragment) {
  normalizeBotApiMedia(root);
  normalizeButtonHtml(root);
  root.querySelectorAll<HTMLTableElement>('table').forEach(normalizeBotApiTable);
  root.querySelectorAll<HTMLDetailsElement>('details').forEach(normalizeBotApiDetails);
  root.querySelectorAll<HTMLLIElement>('li').forEach((element) => {
    if (element.firstElementChild?.matches('ul, ol')) element.prepend(document.createElement('p'));
  });
}

function renderMedia(serializer: DOMSerializer, node: ProseMirrorNode) {
  const attrs = getRichEditorMediaAttrs(node.toJSON());
  if (!attrs) {
    const fallback = document.createElement('span');
    fallback.textContent = node.textContent;
    return fallback;
  }

  const isGroup = attrs.items.length > 1;
  const element = document.createElement(isGroup
    ? (attrs.kind === 'slideshow' ? 'tg-slideshow' : 'tg-collage')
    : 'figure');
  attrs.items.forEach((item) => {
    if (!item.media) return;

    registerRichMedia(item.media);
    element.append(buildMediaElement(item, getRichMediaRef(item.type, item.media.id!)));
  });

  if (node.content.size || attrs.credit.type !== 'empty') {
    const caption = document.createElement('figcaption');
    caption.setAttribute('data-tg-shared-caption', '');
    serializer.serializeFragment(node.content, {}, caption);
    appendStoredCredit(caption, attrs.credit);
    element.append(caption);
  }
  return element;
}

function buildMediaElement(item: RichEditorMediaItem, ref: string) {
  const element = document.createElement(
    item.type === 'document' ? 'tg-document' : item.type === 'photo' ? 'img' : item.type,
  );
  element.setAttribute('src', ref);
  element.setAttribute('alt', '');
  if (item.isSpoiler) element.setAttribute('tg-spoiler', '');
  if (item.url) element.dataset.tgUrl = item.url;
  if (item.webPageId) element.dataset.tgWebPageId = item.webPageId;
  if (item.isAutoplay) element.setAttribute('autoplay', '');
  if (item.isLoop) element.setAttribute('loop', '');
  element.dataset.tgCaption = JSON.stringify(item.caption.text);
  element.dataset.tgCredit = JSON.stringify(item.caption.credit);
  return element;
}

function appendStoredCredit(caption: HTMLElement, credit: ApiRichText) {
  if (credit.type === 'empty') return;

  const cite = document.createElement('cite');
  cite.setAttribute('data-tg-rich-text', JSON.stringify(credit));
  cite.textContent = getRichTextPlainText(credit);
  caption.append(cite);
}

function normalizeBotApiMedia(root: DocumentFragment) {
  root.querySelectorAll<HTMLElement>('tg-collage, tg-slideshow').forEach(normalizeMediaContainer);
  root.querySelectorAll<HTMLElement>('figure').forEach(normalizeMediaContainer);
  root.querySelectorAll<HTMLElement>('img, video, audio, tg-document').forEach(normalizeMediaContainer);
}

function normalizeMediaContainer(element: HTMLElement) {
  if (!element.parentNode || element.closest('[data-rich-editor-media]')) return;

  const mediaElements = element.matches('img, video, audio, tg-document')
    ? [element]
    : Array.from(element.querySelectorAll<HTMLElement>('img, video, audio, tg-document'));
  if (!mediaElements.length) return;

  const items: RichEditorMediaItem[] = [];
  const fallbackText: string[] = [];
  mediaElements.forEach((mediaElement) => {
    const expectedType = mediaElement.matches('tg-document')
      ? 'document' : mediaElement.matches('audio') ? 'audio' : mediaElement.matches('img') ? 'photo' : 'video';
    const source = mediaElement.getAttribute('src') || '';
    const resolved = resolveRichMediaRef(source, expectedType);
    if (!resolved) {
      const alt = mediaElement.getAttribute('alt');
      if (alt) fallbackText.push(alt);
      return;
    }

    const itemCaption = parseMediaItemCaption(mediaElement, element);
    items.push({
      type: resolved.type,
      media: resolved.media,
      caption: itemCaption,
      isSpoiler: mediaElement.hasAttribute('tg-spoiler') || mediaElement.hasAttribute('spoiler') ? true : undefined,
      url: mediaElement.dataset.tgUrl,
      webPageId: parseWebPageId(mediaElement.dataset.tgWebPageId),
      isAutoplay: mediaElement.hasAttribute('autoplay') ? true : undefined,
      isLoop: mediaElement.hasAttribute('loop') ? true : undefined,
    });
  });

  const caption = element.matches('figure, tg-collage, tg-slideshow')
    ? element.querySelector<HTMLElement>(':scope > figcaption[data-tg-shared-caption]')
    || element.querySelector<HTMLElement>(':scope > figcaption')
    || undefined
    : undefined;
  if (!items.length || (items.length > 1 && items.some((item) => item.type === 'document' || item.type === 'audio'))) {
    element.replaceWith(buildMediaFallbackText(element, fallbackText, caption));
    return;
  }

  const attrs: RichEditorMediaAttrs = {
    kind: items.length === 1
      ? items[0].type
      : element.matches('tg-slideshow') ? 'slideshow' : 'collage',
    items,
    credit: parseStoredCredit(caption) || { type: 'empty' },
  };
  const replacement = document.createElement('div');
  replacement.setAttribute('data-rich-editor-media', '');
  replacement.setAttribute('data-rich-editor-media-id', registerRichEditorMediaAttrs(attrs));
  if (caption) {
    caption.querySelector(':scope > cite')?.remove();
    replacement.append(...caption.childNodes);
  }
  const fallback = buildMediaFallbackText(element, fallbackText);
  element.replaceWith(replacement, ...(fallback.textContent ? [fallback] : []));
}

function parseMediaItemCaption(mediaElement: HTMLElement, container: HTMLElement): ApiPageCaption {
  const parentElement = mediaElement.parentElement || undefined;
  const itemFigure = parentElement?.matches('figure') ? parentElement : undefined;
  const caption = itemFigure && itemFigure !== container
    ? itemFigure.querySelector<HTMLElement>(':scope > figcaption') || undefined
    : undefined;
  return {
    text: parseStoredRichText(mediaElement.dataset.tgCaption)
      || parseStoredRichText(caption?.dataset.tgRichText)
      || parseCaptionPlainText(caption)
      || EMPTY_RICH_MEDIA_CAPTION.text,
    credit: parseStoredRichText(mediaElement.dataset.tgCredit)
      || parseStoredCredit(caption)
      || EMPTY_RICH_MEDIA_CAPTION.credit,
  };
}

function parseStoredCredit(caption?: HTMLElement) {
  const cite = caption?.querySelector<HTMLElement>(':scope > cite') || undefined;
  return parseStoredRichText(cite?.dataset.tgRichText)
    || (cite?.textContent ? { type: 'plain', text: cite.textContent } : undefined);
}

function parseWebPageId(value?: string) {
  return value && RE_WEB_PAGE_ID.test(value) ? value : undefined;
}

function parseCaptionPlainText(caption?: HTMLElement): ApiRichText | undefined {
  if (!caption) return undefined;

  const clone = caption.cloneNode(true) as HTMLElement;
  clone.querySelector(':scope > cite')?.remove();
  const text = clone.textContent || '';
  return text ? { type: 'plain', text } : undefined;
}

function parseStoredRichText(value?: string): ApiRichText | undefined {
  if (!value) return undefined;

  try {
    const richText = JSON.parse(value) as Partial<ApiRichText>;
    return richText && typeof richText === 'object' && typeof richText.type === 'string'
      ? richText as ApiRichText
      : undefined;
  } catch {
    return undefined;
  }
}

function buildMediaFallbackText(element: HTMLElement, altText: string[], caption?: HTMLElement) {
  return document.createTextNode([
    ...altText,
    caption?.textContent || (!element.matches('img, video, audio, tg-document') ? element.textContent : ''),
  ].filter(Boolean).join('\n'));
}

function normalizeRenderedBlock(element: HTMLElement) {
  const { richBlockType } = element.dataset;
  const headingLevel = richBlockType?.match(/^heading([1-6])$/)?.[1];
  if (headingLevel) {
    replaceElement(element, `h${headingLevel}`);
    return;
  }

  switch (richBlockType) {
    case 'title':
    case 'header':
      replaceElement(element, 'h1');
      break;
    case 'subtitle':
    case 'subheader':
      replaceElement(element, 'h2');
      break;
    case 'footer':
    case 'mediaCredit':
      replaceElement(element, 'footer');
      break;
    case 'quoteCaption':
      replaceElement(element, 'cite');
      break;
    case 'math':
      replaceElement(element, 'tg-math-block', element.dataset.source || '');
      break;
    case 'mediaCaption':
      normalizeRenderedCaption(element);
      break;
  }
}

function normalizeRenderedCaption(element: HTMLElement) {
  const credit = element.querySelector<HTMLElement>('[data-rich-block-type="mediaCredit"]');
  const paragraph = document.createElement('p');
  const footer = credit ? document.createElement('footer') : undefined;
  if (credit) {
    footer!.append(...credit.childNodes);
    credit.remove();
  }
  paragraph.append(...element.childNodes);
  element.replaceWith(...(paragraph.childNodes.length ? [paragraph] : []), ...(footer ? [footer] : []));
}

function normalizeCustomEmoji(element: HTMLElement) {
  if (element.parentElement?.closest('[data-document-id]')) return;

  const replacement = replaceElement(
    element,
    'tg-emoji',
    element.dataset.alt || element.getAttribute('alt') || element.textContent || '',
  );
  replacement.setAttribute('emoji-id', element.dataset.documentId!);
}

function normalizeRenderedTable(table: HTMLTableElement) {
  const wrapper = table.parentElement?.matches('[data-rich-block-type="table"]')
    ? table.parentElement
    : undefined;
  const title = wrapper?.querySelector<HTMLElement>(':scope > [data-rich-block-type="tableTitle"]');
  if (title) {
    const caption = document.createElement('caption');
    caption.append(...title.childNodes);
    table.prepend(caption);
  }
  table.toggleAttribute('bordered', table.dataset.bordered === 'true');
  table.toggleAttribute('striped', table.dataset.striped === 'true');
  table.toggleAttribute('compact', table.dataset.compact === 'true');
  wrapper?.replaceWith(table);
}

function normalizeBotApiTable(table: HTMLTableElement) {
  const caption = table.querySelector(':scope > caption');
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-rich-editor-table', '');
  const title = document.createElement('div');
  title.setAttribute('data-rich-editor-table-title', '');
  if (caption) {
    title.append(...caption.childNodes);
    caption.remove();
  }

  table.replaceWith(wrapper);
  wrapper.append(title, table);
}

function normalizeBotApiDetails(details: HTMLDetailsElement) {
  const summary = details.querySelector(':scope > summary');
  let content = details.querySelector<HTMLElement>(':scope > [data-rich-block-type="detailsContent"]');
  if (!content) {
    content = document.createElement('div');
    content.dataset.richBlockType = 'detailsContent';
    [...details.childNodes].forEach((node) => {
      if (node !== summary) content!.append(node);
    });
  }
  if (summary) details.append(summary);
  details.append(content);
}

function replaceElement(element: HTMLElement, tagName: string, text?: string) {
  const replacement = document.createElement(tagName);
  if (text !== undefined) {
    replacement.textContent = text;
  } else {
    replacement.append(...element.childNodes);
  }
  element.replaceWith(replacement);
  return replacement;
}

function unwrapElement(element: HTMLElement) {
  element.replaceWith(...element.childNodes);
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
