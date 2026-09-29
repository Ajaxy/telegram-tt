import type { Editor, Range as TiptapRange } from '@tiptap/core';
import type { ElementRef } from '../../../lib/teact/teact';

import type {
  ApiFormattedText,
  ApiInputRichMessage,
  ApiSticker,
} from '../../../api/types';
import type { RichEditorDateClickTarget } from '../../../util/tiptap/extensions/date';
import type { RichEditorMediaItem } from '../../../util/tiptap/richMedia';
import type { RichEditorTooltipsConfig } from '../../common/tooltips/types';

export type RichEditorInsertContent =
  { type: 'text'; text: string }
  | { type: 'formattedText'; text: ApiFormattedText }
  | { type: 'customEmoji'; emoji: ApiSticker }
  | { type: 'mention'; userId?: string; username?: string; text: string };

export type RichEditorMediaFilesHandler = (
  files: File[], position?: number, shouldAppend?: boolean, shouldSendAsFile?: boolean,
) => void;

export type RichEditorMediaEditHandler = (uploadId: string) => void;

export type RichEditorRoot = {
  element: HTMLDivElement;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef?: ElementRef<HTMLCanvasElement>;
  tooltips?: RichEditorTooltipsConfig;
  getIsRichInputExpanded: () => boolean;
  onReady: (source: HTMLElement) => void;
  onUpdate: (isEmpty: boolean, source: HTMLElement) => void;
  onDateClick: (target: RichEditorDateClickTarget) => void;
  onMediaEdit: RichEditorMediaEditHandler;
  onMediaFiles: RichEditorMediaFilesHandler;
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
  hasUnresolvedMedia: boolean;
  isEmpty: () => boolean;
  insertContent: (content: RichEditorInsertContent | RichEditorInsertContent[], shouldPrepend?: boolean) => void;
  insertMedia: (items: RichEditorMediaItem[], position: number, shouldAppend?: boolean) => boolean;
  resetMedia: (uploadId: string) => void;
  resolveMedia: (uploadId: string, media: RichEditorMediaItem['media']) => void;
  redo: NoneToVoidFunction;
  replaceValue: (value: ApiInputRichMessage) => void;
  replaceRange: (
    range: TiptapRange, content: RichEditorInsertContent | RichEditorInsertContent[],
  ) => void;
  registerRoot: (root: RichEditorRoot) => NoneToVoidFunction;
  setValue: (value?: ApiInputRichMessage) => void;
  undo: NoneToVoidFunction;
};
