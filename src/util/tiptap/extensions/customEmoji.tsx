import { Node } from '@tiptap/core';
import type { ElementRef } from '../../../lib/teact/teact';

import type { TeactNodeViewComponentProps } from '../TeactNodeViewRenderer';

import buildClassName from '../../buildClassName';
import {
  buildRichMarkdownNodeInputRule,
  buildRichMarkdownTokenizer,
  escapeRichMarkdownLabel,
  parseRichMarkdownNode,
  type RichMarkdownLink,
} from '../richMarkdown';

import CustomEmoji from '../../../components/common/CustomEmoji';
import TeactNodeViewRenderer from '../TeactNodeViewRenderer';

import styles from '../styling.module.scss';

const CUSTOM_EMOJI_FALLBACK = '\u{FFFC}';
const DOCUMENT_ID_BITS = 64;
const RE_DOCUMENT_ID = /^-?\d+$/;

export type CustomEmojiNodeOptions = {
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef?: ElementRef<HTMLCanvasElement>;
};

export const CustomEmojiNode = Node.create<CustomEmojiNodeOptions>({
  name: 'customEmoji',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  markdownTokenName: 'customEmoji',

  markdownTokenizer: buildRichMarkdownTokenizer('customEmoji', true, buildCustomEmojiMarkdownAttrs),

  parseMarkdown(token, helpers) {
    return parseRichMarkdownNode(token, helpers, true, 'customEmoji', buildCustomEmojiMarkdownAttrs);
  },

  addInputRules() {
    return [buildRichMarkdownNodeInputRule(this.type, buildCustomEmojiMarkdownAttrs)];
  },

  addOptions() {
    return {
      sharedCanvasRef: undefined,
      sharedCanvasHqRef: undefined,
    };
  },

  addAttributes() {
    return {
      documentId: {
        default: undefined,
        parseHTML: (element: HTMLElement) => (
          element.dataset.documentId || element.getAttribute('emoji-id') || undefined
        ),
      },
      alt: {
        default: '',
        parseHTML: (element: HTMLElement) => (
          element.getAttribute('alt') || element.dataset.alt || element.textContent || ''
        ),
      },
      className: {
        default: undefined,
        parseHTML: (element: HTMLElement) => element.getAttribute('class') || undefined,
      },
      src: {
        default: undefined,
        parseHTML: (element: HTMLElement) => element.getAttribute('src') || undefined,
      },
      uniqueId: {
        default: undefined,
        parseHTML: (element: HTMLElement) => element.dataset.uniqueId,
      },
    };
  },

  parseHTML() {
    return [
      { tag: '[data-document-id]' },
      { tag: 'tg-emoji[emoji-id]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['tg-emoji', {
      'emoji-id': HTMLAttributes.documentId,
    }, HTMLAttributes.alt];
  },

  renderText({ node }) {
    return node.attrs.alt;
  },

  renderMarkdown(node) {
    return `![${escapeRichMarkdownLabel(node.attrs?.alt)}](tg://emoji?id=${node.attrs?.documentId})`;
  },

  addNodeView() {
    return TeactNodeViewRenderer(CustomEmojiView, {
      as: 'span',
      selectedOnTextSelection: true,
    });
  },
});

export function buildCustomEmojiMarkdownAttrs(markdown: RichMarkdownLink) {
  if (!markdown.isImage || markdown.url.protocol !== 'tg:' || markdown.url.host !== 'emoji') {
    return undefined;
  }

  const documentId = markdown.url.searchParams.get('id') || undefined;
  if (!documentId || !RE_DOCUMENT_ID.test(documentId)) {
    return undefined;
  }

  const numericDocumentId = BigInt(documentId);
  if (BigInt.asIntN(DOCUMENT_ID_BITS, numericDocumentId) !== numericDocumentId) {
    return undefined;
  }

  return {
    documentId,
    alt: markdown.label || CUSTOM_EMOJI_FALLBACK,
  };
}

function CustomEmojiView({ extension, node }: TeactNodeViewComponentProps) {
  const documentId = typeof node.attrs.documentId === 'string' ? node.attrs.documentId : undefined;
  if (!documentId) {
    return undefined;
  }

  const { sharedCanvasRef, sharedCanvasHqRef } = extension.options as CustomEmojiNodeOptions;

  return (
    <CustomEmoji
      documentId={documentId}
      className={buildClassName(styles.emoji, styles.customEmoji)}
      sharedCanvasRef={sharedCanvasRef}
      sharedCanvasHqRef={sharedCanvasHqRef}
      isSelectable
      withSharedAnimation
    />
  );
}
