import { Node } from '@tiptap/core';
import type { ElementRef } from '../../../lib/teact/teact';

import type { TeactNodeViewComponentProps } from '../TeactNodeViewRenderer';

import buildClassName from '../../buildClassName';
import buildDefinedAttributes from './buildDefinedAttributes';

import CustomEmoji from '../../../components/common/CustomEmoji';
import TeactNodeViewRenderer from '../TeactNodeViewRenderer';

import styles from '../styling.module.scss';

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
      { tag: 'img[data-document-id]' },
      { tag: 'tg-emoji[emoji-id]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const className = buildClassName(
      typeof HTMLAttributes.className === 'string' && HTMLAttributes.className,
      styles.emoji,
      styles.customEmoji,
    );

    return ['img', buildDefinedAttributes({
      class: className,
      alt: HTMLAttributes.alt,
      src: HTMLAttributes.src,
      'data-document-id': HTMLAttributes.documentId,
      'data-unique-id': HTMLAttributes.uniqueId,
    })];
  },

  addNodeView() {
    return TeactNodeViewRenderer(CustomEmojiView, {
      as: 'span',
      selectedOnTextSelection: true,
    });
  },
});

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
