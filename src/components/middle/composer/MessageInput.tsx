import type { ChangeEvent, RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect,
  useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiInputMessageReplyInfo } from '../../../api/types';
import type { IAnchorPosition, ISettings } from '../../../types';
import type { Signal } from '../../../util/signals';

import { EDITABLE_INPUT_ID } from '../../../config';
import { requestForcedReflow, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { selectCanPlayAnimatedEmojis, selectDraft, selectIsInSelectMode } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import { getIsDirectTextInputDisabled } from '../../../util/directInputManager';
import focusEditableElement from '../../../util/focusEditableElement';
import parseEmojiOnlyString from '../../../util/parseEmojiOnlyString';
import { debounce } from '../../../util/schedulers';
import {
  IS_ANDROID, IS_EMOJI_SUPPORTED, IS_IOS, IS_TOUCH_ENV,
} from '../../../util/windowEnvironment';
import renderText from '../../common/helpers/renderText';
import { isSelectionInsideInput } from './helpers/selection';

import useAppLayout from '../../../hooks/useAppLayout';
import useDerivedState from '../../../hooks/useDerivedState';
import useFlag from '../../../hooks/useFlag';
import { isHeavyAnimating } from '../../../hooks/useHeavyAnimationCheck';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useInputCustomEmojis from './hooks/useInputCustomEmojis';

import TextTimer from '../../ui/TextTimer';
import TextFormatter from './TextFormatter';

const CONTEXT_MENU_CLOSE_DELAY_MS = 100;
// Focus slows down animation, also it breaks transition layout in Chrome
const FOCUS_DELAY_MS = 350;
const TRANSITION_DURATION_FACTOR = 50;

const SCROLLER_CLASS = 'input-scroller';
const INPUT_WRAPPER_CLASS = 'message-input-wrapper';

type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  id: string;
  chatId: string;
  threadId: number;
  isAttachmentModalInput?: boolean;
  isStoryInput?: boolean;
  customEmojiPrefix: string;
  editableInputId?: string;
  isReady: boolean;
  isActive: boolean;
  getHtml: Signal<string>;
  placeholder: string;
  timedPlaceholderLangKey?: string;
  timedPlaceholderDate?: number;
  forcedPlaceholder?: string;
  noFocusInterception?: boolean;
  canAutoFocus: boolean;
  shouldSuppressFocus?: boolean;
  shouldSuppressTextFormatter?: boolean;
  canSendPlainText?: boolean;
  onUpdate: (html: string) => void;
  onSuppressedFocus?: () => void;
  onSend: () => void;
  onScroll?: (event: React.UIEvent<HTMLElement>) => void;
  captionLimit?: number;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
  removeSlashSymbol?: () => void;
  removeSlashSymbolAttachmentModal?: () => void;
};

type StateProps = {
  replyInfo?: ApiInputMessageReplyInfo;
  isSelectModeActive?: boolean;
  messageSendKeyCombo?: ISettings['messageSendKeyCombo'];
  canPlayAnimatedEmojis: boolean;
};

const MAX_ATTACHMENT_MODAL_INPUT_HEIGHT = 160;
const MAX_STORY_MODAL_INPUT_HEIGHT = 128;
const TAB_INDEX_PRIORITY_TIMEOUT = 2000;
// Heuristics allowing the user to make a triple click
const SELECTION_RECALCULATE_DELAY_MS = 260;
const TEXT_FORMATTER_SAFE_AREA_PX = 140;
// For some reason Safari inserts `<br>` after user removes text from input
const SAFARI_BR = '<br>';
const IGNORE_KEYS = [
  'Esc', 'Escape', 'Enter', 'PageUp', 'PageDown', 'Meta', 'Alt', 'Ctrl', 'ArrowDown', 'ArrowUp', 'Control', 'Shift',
];

function clearSelection() {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  if (selection.removeAllRanges) {
    selection.removeAllRanges();
  } else if (selection.empty) {
    selection.empty();
  }
}

const MessageInput: FC<OwnProps & StateProps> = ({
  ref,
  id,
  chatId,
  captionLimit,
  isAttachmentModalInput,
  isStoryInput,
  customEmojiPrefix,
  editableInputId,
  isReady,
  isActive,
  getHtml,
  placeholder,
  timedPlaceholderLangKey,
  timedPlaceholderDate,
  forcedPlaceholder,
  canSendPlainText,
  canAutoFocus,
  noFocusInterception,
  shouldSuppressFocus,
  shouldSuppressTextFormatter,
  replyInfo,
  isSelectModeActive,
  canPlayAnimatedEmojis,
  messageSendKeyCombo,
  onUpdate,
  onSuppressedFocus,
  onSend,
  onScroll,
  onFocus,
  onBlur,
  removeSlashSymbolAttachmentModal,
  removeSlashSymbol,
}) => {
  const {
    editLastMessage,
    replyToNextMessage,
    showAllowedMessageTypesNotification,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  let inputRef = useRef<HTMLDivElement>(null);
  if (ref) {
    inputRef = ref;
  }

  // eslint-disable-next-line no-null/no-null
  const selectionTimeoutRef = useRef<number>(null);
  // eslint-disable-next-line no-null/no-null
  const cloneRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const scrollerCloneRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const absoluteContainerRef = useRef<HTMLDivElement>(null);

  const lang = useLang();
  const isContextMenuOpenRef = useRef(false);
  const [isTextFormatterOpen, openTextFormatter, closeTextFormatter] = useFlag();
  const [textFormatterAnchorPosition, setTextFormatterAnchorPosition] = useState<IAnchorPosition>();
  const [selectedRange, setSelectedRange] = useState<Range>();
  const [isTextFormatterDisabled, setIsTextFormatterDisabled] = useState<boolean>(false);
  const { isMobile } = useAppLayout();
  const isMobileDevice = isMobile && (IS_IOS || IS_ANDROID);

  const [shouldDisplayTimer, setShouldDisplayTimer] = useState(false);

  useEffect(() => {
    setShouldDisplayTimer(Boolean(timedPlaceholderLangKey && timedPlaceholderDate));
  }, [timedPlaceholderDate, timedPlaceholderLangKey]);

  const handleTimerEnd = useLastCallback(() => {
    setShouldDisplayTimer(false);
  });

  useInputCustomEmojis(
    getHtml,
    inputRef,
    sharedCanvasRef,
    sharedCanvasHqRef,
    absoluteContainerRef,
    customEmojiPrefix,
    canPlayAnimatedEmojis,
    isReady,
    isActive,
  );

  const maxInputHeight = isAttachmentModalInput
    ? MAX_ATTACHMENT_MODAL_INPUT_HEIGHT
    : isStoryInput ? MAX_STORY_MODAL_INPUT_HEIGHT : (isMobile ? 256 : 416);
  const updateInputHeight = useLastCallback((willSend = false) => {
    requestForcedReflow(() => {
      const scroller = inputRef.current!.closest<HTMLDivElement>(`.${SCROLLER_CLASS}`)!;
      const currentHeight = Number(scroller.style.height.replace('px', ''));
      const clone = scrollerCloneRef.current!;
      const { scrollHeight } = clone;
      const newHeight = Math.min(scrollHeight, maxInputHeight);

      if (newHeight === currentHeight) {
        return undefined;
      }

      const isOverflown = scrollHeight > maxInputHeight;

      function exec() {
        const transitionDuration = Math.round(
          TRANSITION_DURATION_FACTOR * Math.log(Math.abs(newHeight - currentHeight)),
        );
        scroller.style.height = `${newHeight}px`;
        scroller.style.transitionDuration = `${transitionDuration}ms`;
        scroller.classList.toggle('overflown', isOverflown);
      }

      if (willSend) {
        // Delay to next frame to sync with sending animation
        requestMutation(exec);
        return undefined;
      } else {
        return exec;
      }
    });
  });

  useLayoutEffect(() => {
    if (!isAttachmentModalInput) return;
    updateInputHeight(false);
  }, [isAttachmentModalInput, updateInputHeight]);

  const htmlRef = useRef(getHtml());
  useLayoutEffect(() => {
    const html = isActive ? getHtml() : '';

    if (html !== inputRef.current!.innerHTML) {
      inputRef.current!.innerHTML = html;
    }

    if (html !== cloneRef.current!.innerHTML) {
      cloneRef.current!.innerHTML = html;
    }

    if (html !== htmlRef.current) {
      htmlRef.current = html;

      updateInputHeight(!html);
    }
  }, [getHtml, isActive, updateInputHeight]);

  useEffect(() => {
    if (isActive && removeSlashSymbolAttachmentModal && removeSlashSymbol) {
      removeSlashSymbolAttachmentModal();
      removeSlashSymbol();
    }
  }, [isActive, removeSlashSymbol, removeSlashSymbolAttachmentModal]);

  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const focusInput = useLastCallback(() => {
    if (!inputRef.current) {
      return;
    }

    if (isHeavyAnimating()) {
      setTimeout(focusInput, FOCUS_DELAY_MS);
      return;
    }

    focusEditableElement(inputRef.current!);
  });

  const handleCloseTextFormatter = useLastCallback(() => {
    closeTextFormatter();
    clearSelection();
  });

  function checkSelection() {
    // Disable the formatter on iOS devices for now.
    if (IS_IOS) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || isContextMenuOpenRef.current) {
      closeTextFormatter();
      if (IS_ANDROID) {
        setIsTextFormatterDisabled(false);
      }
      return false;
    }

    const selectionRange = selection.getRangeAt(0);
    const selectedText = selectionRange.toString().trim();
    if (
      shouldSuppressTextFormatter
      || !isSelectionInsideInput(selectionRange, editableInputId || EDITABLE_INPUT_ID)
      || !selectedText
      || parseEmojiOnlyString(selectedText)
      || !selectionRange.START_TO_END
    ) {
      closeTextFormatter();
      return false;
    }

    return true;
  }

  function processSelection() {
    if (!checkSelection()) {
      return;
    }

    if (isTextFormatterDisabled) {
      return;
    }

    const selectionRange = window.getSelection()!.getRangeAt(0);
    const selectionRect = selectionRange.getBoundingClientRect();
    const scrollerRect = inputRef.current!.closest<HTMLDivElement>(`.${SCROLLER_CLASS}`)!.getBoundingClientRect();

    let x = (selectionRect.left + selectionRect.width / 2) - scrollerRect.left;

    if (x < TEXT_FORMATTER_SAFE_AREA_PX) {
      x = TEXT_FORMATTER_SAFE_AREA_PX;
    } else if (x > scrollerRect.width - TEXT_FORMATTER_SAFE_AREA_PX) {
      x = scrollerRect.width - TEXT_FORMATTER_SAFE_AREA_PX;
    }

    setTextFormatterAnchorPosition({
      x,
      y: selectionRect.top - scrollerRect.top,
    });

    setSelectedRange(selectionRange);
    openTextFormatter();
  }

  function processSelectionWithTimeout() {
    if (selectionTimeoutRef.current) {
      window.clearTimeout(selectionTimeoutRef.current);
    }
    // Small delay to allow browser properly recalculate selection
    selectionTimeoutRef.current = window.setTimeout(processSelection, SELECTION_RECALCULATE_DELAY_MS);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (e.button !== 2) {
      const listenerEl = e.currentTarget.closest(`.${INPUT_WRAPPER_CLASS}`) || e.target;

      listenerEl.addEventListener('mouseup', processSelectionWithTimeout, { once: true });
      return;
    }

    if (isContextMenuOpenRef.current) {
      return;
    }

    isContextMenuOpenRef.current = true;

    function handleCloseContextMenu(e2: KeyboardEvent | MouseEvent) {
      if (e2 instanceof KeyboardEvent && e2.key !== 'Esc' && e2.key !== 'Escape') {
        return;
      }

      setTimeout(() => {
        isContextMenuOpenRef.current = false;
      }, CONTEXT_MENU_CLOSE_DELAY_MS);

      window.removeEventListener('keydown', handleCloseContextMenu);
      window.removeEventListener('mousedown', handleCloseContextMenu);
    }

    document.addEventListener('mousedown', handleCloseContextMenu);
    document.addEventListener('keydown', handleCloseContextMenu);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // https://levelup.gitconnected.com/javascript-events-handlers-keyboard-and-load-events-1b3e46a6b0c3#1960
    const { isComposing } = e;

    const html = getHtml();
    if (!isComposing && !html && (e.metaKey || e.ctrlKey)) {
      const targetIndexDelta = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : undefined;
      if (targetIndexDelta) {
        e.preventDefault();

        replyToNextMessage({ targetIndexDelta });
        return;
      }
    }

    if (e.altKey) { // for onSendSchedule Alt+Enter hotkey
      return;
    }

    if (!isComposing && e.key === 'Enter' && !e.shiftKey) {
      if (
        !isMobileDevice
        && (
          (messageSendKeyCombo === 'enter' && !e.shiftKey)
          || (messageSendKeyCombo === 'ctrl-enter' && (e.ctrlKey || e.metaKey))
        )
      ) {
        e.preventDefault();

        closeTextFormatter();
        onSend();
      }
    } else if (!isComposing && e.key === 'ArrowUp' && !html && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      editLastMessage();
    } else {
      e.target.addEventListener('keyup', processSelectionWithTimeout, { once: true });
    }
  }

  function handleChange(e: ChangeEvent<HTMLDivElement>) {
    const { innerHTML, textContent } = e.currentTarget;

    onUpdate(innerHTML === SAFARI_BR ? '' : innerHTML);

    // Reset focus on the input to remove any active styling when input is cleared
    if (
      !IS_TOUCH_ENV
      && (!textContent || !textContent.length)
      // When emojis are not supported, innerHTML contains an emoji img tag that doesn't exist in the textContext
      && !(!IS_EMOJI_SUPPORTED && innerHTML.includes('emoji-small'))
      && !(innerHTML.includes('custom-emoji'))
    ) {
      const selection = window.getSelection()!;
      if (selection) {
        inputRef.current!.blur();
        selection.removeAllRanges();
        focusEditableElement(inputRef.current!, true);
      }
    }
  }

  function handleAndroidContextMenu(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!checkSelection()) {
      return;
    }

    setIsTextFormatterDisabled(!isTextFormatterDisabled);

    if (!isTextFormatterDisabled) {
      e.preventDefault();
      e.stopPropagation();

      processSelection();
    } else {
      closeTextFormatter();
    }
  }

  function handleClick() {
    if (isAttachmentModalInput || canSendPlainText) return;
    showAllowedMessageTypesNotification({ chatId });
  }

  useEffect(() => {
    if (IS_TOUCH_ENV) {
      return;
    }

    if (canAutoFocus) {
      focusInput();
    }
  }, [chatId, focusInput, replyInfo, canAutoFocus]);

  useEffect(() => {
    if (
      !chatId
      || editableInputId !== EDITABLE_INPUT_ID
      || noFocusInterception
      || isMobileDevice
      || isSelectModeActive
    ) {
      return undefined;
    }

    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      if (getIsDirectTextInputDisabled()) {
        return;
      }

      const { key } = e;
      const target = e.target as HTMLElement | undefined;

      if (!target || IGNORE_KEYS.includes(key)) {
        return;
      }

      const input = inputRef.current!;
      const isSelectionCollapsed = document.getSelection()?.isCollapsed;

      if (
        ((key.startsWith('Arrow') || (e.shiftKey && key === 'Shift')) && !isSelectionCollapsed)
        || (e.code === 'KeyC' && (e.ctrlKey || e.metaKey) && target.tagName !== 'INPUT')
      ) {
        return;
      }

      if (
        input
        && target !== input
        && target.tagName !== 'INPUT'
        && target.tagName !== 'TEXTAREA'
        && !target.isContentEditable
      ) {
        focusEditableElement(input, true, true);

        const newEvent = new KeyboardEvent(e.type, e as any);
        input.dispatchEvent(newEvent);
      }
    };

    document.addEventListener('keydown', handleDocumentKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
    };
  }, [chatId, editableInputId, isMobileDevice, isSelectModeActive, noFocusInterception]);

  useEffect(() => {
    const captureFirstTab = debounce((e: KeyboardEvent) => {
      if (e.key === 'Tab' && !getIsDirectTextInputDisabled()) {
        e.preventDefault();
        requestMutation(focusInput);
      }
    }, TAB_INDEX_PRIORITY_TIMEOUT, true, false);

    return captureKeyboardListeners({ onTab: captureFirstTab });
  }, [focusInput]);

  useEffect(() => {
    const input = inputRef.current!;

    function suppressFocus() {
      input.blur();
    }

    if (shouldSuppressFocus) {
      input.addEventListener('focus', suppressFocus);
    }

    return () => {
      input.removeEventListener('focus', suppressFocus);
    };
  }, [shouldSuppressFocus]);

  const isTouched = useDerivedState(() => Boolean(isActive && getHtml()), [isActive, getHtml]);

  const className = buildClassName(
    'form-control allow-selection',
    isTouched && 'touched',
    shouldSuppressFocus && 'focus-disabled',
  );

  return (
    <div id={id} onClick={shouldSuppressFocus ? onSuppressedFocus : undefined} dir={lang.isRtl ? 'rtl' : undefined}>
      <div
        className={buildClassName('custom-scroll', SCROLLER_CLASS)}
        onScroll={onScroll}
        onClick={!isAttachmentModalInput && !canSendPlainText ? handleClick : undefined}
      >
        <div className="input-scroller-content">
          <div
            ref={inputRef}
            id={editableInputId || EDITABLE_INPUT_ID}
            className={className}
            contentEditable={isAttachmentModalInput || canSendPlainText}
            role="textbox"
            dir="auto"
            tabIndex={0}
            onClick={focusInput}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}
            onContextMenu={IS_ANDROID ? handleAndroidContextMenu : undefined}
            onTouchCancel={IS_ANDROID ? processSelectionWithTimeout : undefined}
            aria-label={placeholder}
            onFocus={onFocus}
            onBlur={onBlur}
          />
          {!forcedPlaceholder && (
            <span
              className={buildClassName(
                'placeholder-text',
                !isAttachmentModalInput && !canSendPlainText && 'with-icon',
              )}
              dir="auto"
            >
              {!isAttachmentModalInput && !canSendPlainText
                && <i className="icon icon-lock-badge placeholder-icon" />}
              {shouldDisplayTimer ? (
                <TextTimer langKey={timedPlaceholderLangKey!} endsAt={timedPlaceholderDate!} onEnd={handleTimerEnd} />
              ) : placeholder}
            </span>
          )}
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          <div ref={absoluteContainerRef} className="absolute-video-container" />
        </div>
      </div>
      <div ref={scrollerCloneRef} className={buildClassName('custom-scroll', SCROLLER_CLASS, 'clone')}>
        <div className="input-scroller-content">
          <div ref={cloneRef} className={buildClassName(className, 'clone')} dir="auto" />
        </div>
      </div>
      {captionLimit !== undefined && (
        <div className="max-length-indicator" dir="auto">
          {captionLimit}
        </div>
      )}
      <TextFormatter
        isOpen={isTextFormatterOpen}
        anchorPosition={textFormatterAnchorPosition}
        selectedRange={selectedRange}
        setSelectedRange={setSelectedRange}
        onClose={handleCloseTextFormatter}
      />
      {forcedPlaceholder && <span className="forced-placeholder">{renderText(forcedPlaceholder!)}</span>}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }: OwnProps): StateProps => {
    const { messageSendKeyCombo } = global.settings.byKey;

    return {
      messageSendKeyCombo,
      replyInfo: chatId && threadId ? selectDraft(global, chatId, threadId)?.replyInfo : undefined,
      isSelectModeActive: selectIsInSelectMode(global),
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
    };
  },
)(MessageInput));
