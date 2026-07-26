import type { Editor } from '@tiptap/core';
import type { ElementRef } from '../../../lib/teact/teact';

import type { ApiFormattedText, ApiInputRichMessage, ApiSticker } from '../../../api/types';
import type { RichEditorDateClickTarget } from '../../../util/tiptap/extensions/date';

export type RichEditorInsertContent =
  { type: 'text'; text: string }
  | { type: 'formattedText'; text: ApiFormattedText }
  | { type: 'customEmoji'; emoji: ApiSticker }
  | { type: 'mention'; userId?: string; username?: string; text: string };

export type RichEditorSuggestion = {
  range: {
    from: number;
    to: number;
  };
  query: string;
  text: string;
  clientRect?: () => DOMRect | undefined;
};

export type RichEditorRoot = {
  element: HTMLDivElement;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef?: ElementRef<HTMLCanvasElement>;
  blockPlaceholder: string;
  pullquotePlaceholder: string;
  quoteCaptionPlaceholder: string;
  tableTitlePlaceholder: string;
  unsupportedPlaceholder: string;
  getIsRichInputExpanded: () => boolean;
  onReady: (source: HTMLElement) => void;
  onUpdate: (isEmpty: boolean, source: HTMLElement) => void;
  onDateClick: (target: RichEditorDateClickTarget) => void;
};

export type RichEditor = {
  editor?: Editor;
  isReady: boolean;
  value: ApiInputRichMessage;
  mentionSuggestion?: RichEditorSuggestion;
  canUndo: boolean;
  canRedo: boolean;
  deleteCharacterBeforeSelection: NoneToVoidFunction;
  focus: NoneToVoidFunction;
  getAsFormatted: () => ApiFormattedText | undefined;
  getTextBeforeSelection: () => string;
  getValue: () => ApiInputRichMessage;
  hasCollapsedSelection: () => boolean;
  isEmpty: () => boolean;
  insertContent: (content: RichEditorInsertContent | RichEditorInsertContent[], shouldPrepend?: boolean) => void;
  redo: NoneToVoidFunction;
  replaceValue: (value: ApiInputRichMessage) => void;
  replaceTextBeforeSelection: (
    textToReplace: string, content: RichEditorInsertContent | RichEditorInsertContent[],
  ) => void;
  replaceRange: (
    range: RichEditorSuggestion['range'], content: RichEditorInsertContent | RichEditorInsertContent[],
  ) => void;
  registerRoot: (root: RichEditorRoot) => NoneToVoidFunction;
  setValue: (value?: ApiInputRichMessage) => void;
  undo: NoneToVoidFunction;
};
