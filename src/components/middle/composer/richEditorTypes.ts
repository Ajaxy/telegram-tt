import type { Editor, Range as TiptapRange } from '@tiptap/core';
import type { ElementRef } from '../../../lib/teact/teact';

import type {
  ApiFormattedText,
  ApiInputRichMessage,
  ApiSticker,
} from '../../../api/types';
import type { RichEditorDateClickTarget } from '../../../util/tiptap/extensions/date';
import type { RichEditorTooltipsConfig } from '../../common/tooltips/types';

export type RichEditorInsertContent =
  { type: 'text'; text: string }
  | { type: 'formattedText'; text: ApiFormattedText }
  | { type: 'customEmoji'; emoji: ApiSticker }
  | { type: 'mention'; userId?: string; username?: string; text: string };

export type RichEditorRoot = {
  element: HTMLDivElement;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef?: ElementRef<HTMLCanvasElement>;
  tooltips?: RichEditorTooltipsConfig;
  getIsRichInputExpanded: () => boolean;
  onReady: (source: HTMLElement) => void;
  onUpdate: (isEmpty: boolean, source: HTMLElement) => void;
  onDateClick: (target: RichEditorDateClickTarget) => void;
};

export type RichEditor = {
  editor?: Editor;
  isReady: boolean;
  value: ApiInputRichMessage;
  canUndo: boolean;
  canRedo: boolean;
  deleteCharacterBeforeSelection: NoneToVoidFunction;
  focus: NoneToVoidFunction;
  getAsFormatted: () => ApiFormattedText | undefined;
  getValue: () => ApiInputRichMessage;
  hasCollapsedSelection: () => boolean;
  isEmpty: () => boolean;
  insertContent: (content: RichEditorInsertContent | RichEditorInsertContent[], shouldPrepend?: boolean) => void;
  redo: NoneToVoidFunction;
  replaceValue: (value: ApiInputRichMessage) => void;
  replaceRange: (
    range: TiptapRange, content: RichEditorInsertContent | RichEditorInsertContent[],
  ) => void;
  registerRoot: (root: RichEditorRoot) => NoneToVoidFunction;
  setValue: (value?: ApiInputRichMessage) => void;
  undo: NoneToVoidFunction;
};
