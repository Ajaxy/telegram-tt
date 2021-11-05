import { ChangeEvent } from 'react';
import React, {
  FC, useEffect, useRef, memo, useState, useCallback,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { IAnchorPosition, ISettings } from '../../../types';

import { EDITABLE_INPUT_ID } from '../../../config';
import { selectCurrentMessageList, selectReplyingToId } from '../../../modules/selectors';
import { debounce } from '../../../util/schedulers';
import focusEditableElement from '../../../util/focusEditableElement';
import buildClassName from '../../../util/buildClassName';
import { pick } from '../../../util/iteratees';
import {
  IS_ANDROID, IS_EMOJI_SUPPORTED, IS_IOS, IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV,
} from '../../../util/environment';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import useLayoutEffectWithPrevDeps from '../../../hooks/useLayoutEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import parseEmojiOnlyString from '../../common/helpers/parseEmojiOnlyString';
import { isSelectionInsideInput } from './helpers/selection';
import useLang from '../../../hooks/useLang';
import renderText from '../../common/helpers/renderText';

import TextFormatter from './TextFormatter';

const CONTEXT_MENU_CLOSE_DELAY_MS = 100;
// Focus slows down animation, also it breaks transition layout in Chrome
const FOCUS_DELAY_MS = 350;
const TRANSITION_DURATION_FACTOR = 50;

type OwnProps = {
  id: string;
  isAttachmentModalInput?: boolean;
  editableInputId?: string;
  html: string;
  placeholder: string;
  forcedPlaceholder?: string;
  shouldSetFocus: boolean;
  shouldSuppressFocus?: boolean;
  shouldSuppressTextFormatter?: boolean;
  onUpdate: (html: string) => void;
  onSuppressedFocus?: () => void;
  onSend: () => void;
};

type StateProps = {
  currentChatId?: string;
  replyingToId?: number;
  noTabCapture?: boolean;
  messageSendKeyCombo?: ISettings['messageSendKeyCombo'];
};

type DispatchProps = Pick<GlobalActions, 'editLastMessage' | 'replyToNextMessage'>;

const MAX_INPUT_HEIGHT = IS_SINGLE_COLUMN_LAYOUT ? 256 : 416;
const TAB_INDEX_PRIORITY_TIMEOUT = 2000;
const TEXT_FORMATTER_SAFE_AREA_PX = 90;
// For some reason Safari inserts `<br>` after user removes text from input
const SAFARI_BR = '<br>';

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

const MessageInput: FC<OwnProps & StateProps & DispatchProps> = ({
  id,
  isAttachmentModalInput,
  editableInputId,
  html,
  placeholder,
  forcedPlaceholder,
  shouldSetFocus,
  shouldSuppressFocus,
  shouldSuppressTextFormatter,
  onUpdate,
  onSuppressedFocus,
  onSend,
  currentChatId,
  replyingToId,
  noTabCapture,
  messageSendKeyCombo,
  editLastMessage,
  replyToNextMessage,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const cloneRef = useRef<HTMLDivElement>(null);

  const lang = useLang();
  const isContextMenuOpenRef = useRef(false);
  const [isTextFormatterOpen, openTextFormatter, closeTextFormatter] = useFlag();
  const [textFormatterAnchorPosition, setTextFormatterAnchorPosition] = useState<IAnchorPosition>();
  const [selectedRange, setSelectedRange] = useState<Range>();

  useEffect(() => {
    if (!isAttachmentModalInput) return;
    updateInputHeight(false);
  }, [isAttachmentModalInput]);

  useLayoutEffectWithPrevDeps(([prevHtml]) => {
    if (html !== inputRef.current!.innerHTML) {
      inputRef.current!.innerHTML = html;
    }

    if (html !== cloneRef.current!.innerHTML) {
      cloneRef.current!.innerHTML = html;
    }

    if (prevHtml !== undefined && prevHtml !== html) {
      updateInputHeight(!html.length);
    }
  }, [html]);

  const focusInput = useCallback(() => {
    // Avoid focusing during animation
    if (inputRef.current!.closest('.from, .to')) {
      setTimeout(focusInput, FOCUS_DELAY_MS);
      return;
    }

    focusEditableElement(inputRef.current!);
  }, []);

  const handleCloseTextFormatter = useCallback(() => {
    closeTextFormatter();
    clearSelection();
  }, [closeTextFormatter]);

  function checkSelection() {
    // Disable the formatter on iOS devices for now.
    if (IS_IOS) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || isContextMenuOpenRef.current) {
      closeTextFormatter();
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

    const selectionRange = window.getSelection()!.getRangeAt(0);
    const selectionRect = selectionRange.getBoundingClientRect();
    const inputRect = inputRef.current!.getBoundingClientRect();

    let x = (selectionRect.left + selectionRect.width / 2) - inputRect.left;

    if (x < TEXT_FORMATTER_SAFE_AREA_PX) {
      x = TEXT_FORMATTER_SAFE_AREA_PX;
    } else if (x > inputRect.width - TEXT_FORMATTER_SAFE_AREA_PX) {
      x = inputRect.width - TEXT_FORMATTER_SAFE_AREA_PX;
    }

    setTextFormatterAnchorPosition({
      x,
      y: selectionRect.top - inputRect.top,
    });

    setSelectedRange(selectionRange);
    openTextFormatter();
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    function handleMouseUp() {
      processSelection();

      event.target.removeEventListener('mouseup', handleMouseUp);
    }

    if (event.button !== 2) {
      event.target.addEventListener('mouseup', handleMouseUp);
      return;
    }

    if (isContextMenuOpenRef.current === true) {
      return;
    }

    isContextMenuOpenRef.current = true;

    function closeContextMenuMouseListener() {
      setTimeout(() => {
        isContextMenuOpenRef.current = false;
      }, CONTEXT_MENU_CLOSE_DELAY_MS);

      window.removeEventListener('mouseup', closeContextMenuMouseListener);
    }

    function closeContextMenuKeyListener(e: KeyboardEvent) {
      if (e.key !== 'Esc' && e.key !== 'Escape') {
        return;
      }

      setTimeout(() => {
        isContextMenuOpenRef.current = false;
      }, CONTEXT_MENU_CLOSE_DELAY_MS);

      window.removeEventListener('keydown', closeContextMenuKeyListener);
    }

    document.addEventListener('mousedown', closeContextMenuMouseListener);
    document.addEventListener('keydown', closeContextMenuKeyListener);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    function handleKeyUp() {
      processSelection();

      e.target.removeEventListener('keyup', handleKeyUp);
    }

    if (e.metaKey && !html.length) {
      const targetIndexDelta = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : undefined;
      if (targetIndexDelta) {
        e.preventDefault();

        replyToNextMessage({ targetIndexDelta });
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (
        !(IS_IOS || IS_ANDROID)
        && (
          (messageSendKeyCombo === 'enter' && !e.shiftKey)
          || (messageSendKeyCombo === 'ctrl-enter' && (e.ctrlKey || e.metaKey))
        )
      ) {
        e.preventDefault();

        closeTextFormatter();
        onSend();
      }
    } else if (e.key === 'ArrowUp' && !html.length && !e.metaKey && !e.altKey) {
      e.preventDefault();
      editLastMessage();
    } else {
      e.target.addEventListener('keyup', handleKeyUp);
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
    ) {
      const selection = window.getSelection()!;
      if (selection) {
        inputRef.current!.blur();
        selection.removeAllRanges();
        focusEditableElement(inputRef.current!, true);
      }
    }
  }

  function stopEvent(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!checkSelection()) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
  }

  function updateInputHeight(willSend = false) {
    const input = inputRef.current!;
    const clone = cloneRef.current!;
    const currentHeight = Number(input.style.height.replace('px', ''));
    const newHeight = Math.min(clone.scrollHeight, MAX_INPUT_HEIGHT);
    if (newHeight === currentHeight) {
      return;
    }

    const transitionDuration = Math.round(
      TRANSITION_DURATION_FACTOR * Math.log(Math.abs(newHeight - currentHeight)),
    );

    const exec = () => {
      input.style.height = `${newHeight}px`;
      input.style.transitionDuration = `${transitionDuration}ms`;
      input.classList.toggle('overflown', clone.scrollHeight > MAX_INPUT_HEIGHT);
    };

    if (willSend) {
      // Sync with sending animation
      requestAnimationFrame(exec);
    } else {
      exec();
    }
  }

  useEffect(() => {
    if (IS_TOUCH_ENV) {
      return;
    }

    if (shouldSetFocus) {
      focusInput();
    }
  }, [currentChatId, focusInput, replyingToId, shouldSetFocus]);

  useEffect(() => {
    if (noTabCapture) {
      return undefined;
    }

    const captureFirstTab = debounce((e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        requestAnimationFrame(focusInput);
      }
    }, TAB_INDEX_PRIORITY_TIMEOUT, true, false);

    return captureKeyboardListeners({ onTab: captureFirstTab });
  }, [focusInput, noTabCapture]);

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

  const className = buildClassName(
    'form-control custom-scroll',
    html.length > 0 && 'touched',
    shouldSuppressFocus && 'focus-disabled',
  );

  return (
    <div id={id} onClick={shouldSuppressFocus ? onSuppressedFocus : undefined} dir={lang.isRtl ? 'rtl' : undefined}>
      <div
        ref={inputRef}
        id={editableInputId || EDITABLE_INPUT_ID}
        className={className}
        contentEditable
        dir="auto"
        onClick={focusInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onContextMenu={IS_ANDROID ? stopEvent : undefined}
        onTouchCancel={IS_ANDROID ? processSelection : undefined}
      />
      <div ref={cloneRef} className={buildClassName(className, 'clone')} dir="auto" />
      {!forcedPlaceholder && <span className="placeholder-text" dir="auto">{placeholder}</span>}
      <TextFormatter
        isOpen={isTextFormatterOpen}
        anchorPosition={textFormatterAnchorPosition}
        selectedRange={selectedRange}
        onClose={handleCloseTextFormatter}
      />
      {forcedPlaceholder && <span className="forced-placeholder">{renderText(forcedPlaceholder!)}</span>}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId: currentChatId, threadId } = selectCurrentMessageList(global) || {};
    const { messageSendKeyCombo } = global.settings.byKey;

    return {
      currentChatId,
      messageSendKeyCombo,
      replyingToId: currentChatId && threadId ? selectReplyingToId(global, currentChatId, threadId) : undefined,
      noTabCapture: global.isPollModalOpen || global.payment.isPaymentModalOpen,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['editLastMessage', 'replyToNextMessage']),
)(MessageInput));
