import { TextSelection } from '@tiptap/pm/state';
import type { ElementRef, TeactNode } from '../../../lib/teact/teact';
import {
  memo, useEffect, useLayoutEffect, useMemo,
  useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiFormattedText, ApiInputDraftReplyInfo, ApiInputRichMessage } from '../../../api/types';
import type { SharedSettings } from '../../../global/types';
import type {
  MessageListType, ThreadId,
} from '../../../types';
import type { RichEditorDateClickTarget } from '../../../util/tiptap/extensions/date';
import type { RichEditorTooltipsConfig } from '../../common/tooltips/types';
import type { RichEditor } from './richEditorTypes';

import { DEBUG, EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID } from '../../../config';
import { requestForcedReflow, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getRichMessageUsage } from '../../../global/helpers/richMessage';
import { selectIsInSelectMode } from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { selectDraft } from '../../../global/selectors/threads';
import { IS_TAURI } from '../../../util/browser/globalEnvironment';
import {
  IS_ANDROID, IS_IOS, IS_TOUCH_ENV,
} from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import captureKeyboardListeners, { hasActiveHandler } from '../../../util/captureKeyboardListeners';
import { getIsDirectTextInputDisabled } from '../../../util/directInputManager';
import focusEditableElement from '../../../util/focusEditableElement';
import { subscribeToCodeLanguageLoad } from '../../../util/highlightCode';
import { debounce, fastRaf } from '../../../util/schedulers';
import { getUtf8Length } from '../../../util/textFormat';
import tiptapStyles from '../../../util/tiptap/styling.module.scss';
import renderText from '../../common/helpers/renderText';
import {
  getRichInputAsFormatted,
  hasUnsupportedRichBlocks,
  removeUnsupportedRichBlocks,
} from '../../ui/textInput/richText';
import { RICH_INPUT_MODE_CHANGED_META } from './helpers/richEditorMode';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useScrollableHint from '../../../hooks/useScrollableHint';
import { useStateRef } from '../../../hooks/useStateRef';

import AnimatedCounter from '../../common/AnimatedCounter';
import CalendarModal from '../../common/CalendarModal.async';
import Icon from '../../common/icons/Icon';
import { refreshRichEditorTooltips } from '../../common/tooltips/extensions/RichEditorTooltips';
import Button from '../../ui/Button';
import FormattedDateModal from './FormattedDateModal';
import RichEditorToolbar from './RichEditorToolbar';

const CONTEXT_MENU_CLOSE_DELAY_MS = 100;
const TRANSITION_DURATION_FACTOR = 50;
const COLLAPSED_RICH_PREVIEW_LINE_COUNT = 3;

const SCROLLER_CLASS = 'input-scroller';
const CONTENT_EDITABLE_SELECTOR = 'div[contenteditable]';

export type OwnProps = {
  ref?: ElementRef<HTMLDivElement>;
  id: string;
  chatId: string;
  threadId: ThreadId;
  richEditor: RichEditor;
  tooltips?: RichEditorTooltipsConfig;
  isAttachmentModalInput?: boolean;
  isStoryInput?: boolean;
  editableInputId?: string;
  isActive: boolean;
  placeholder: TeactNode | string;
  forcedPlaceholder?: string;
  noFocusInterception?: boolean;
  canAutoFocus: boolean;
  shouldSuppressFocus?: boolean;
  canSendPlainText?: boolean;
  isRichInputExpanded?: boolean;
  isNeedPremium?: boolean;
  isRichOnlyContent?: boolean;
  messageListType?: MessageListType;
  maxLength?: number;
  onRichInputCollapse?: NoneToVoidFunction;
  onRichInputExpand?: NoneToVoidFunction;
  onSuppressedFocus?: () => void;
  onSend: () => void;
  onScroll?: (event: React.UIEvent<HTMLElement>) => void;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
};

type StateProps = {
  replyInfo?: ApiInputDraftReplyInfo;
  isSelectModeActive?: boolean;
  messageSendKeyCombo?: SharedSettings['messageSendKeyCombo'];
};

const MAX_ATTACHMENT_MODAL_INPUT_HEIGHT = 160;
const MAX_MESSAGE_INPUT_HEIGHT = 160;
const MAX_STORY_MODAL_INPUT_HEIGHT = 128;
const TAB_INDEX_PRIORITY_TIMEOUT = 2000;
const MAX_REMAINING_LENGTH_TO_SHOW = 100;
const IGNORE_KEYS = [
  'Esc', 'Escape', 'Enter', 'PageUp', 'PageDown', 'Meta', 'Alt', 'Ctrl', 'ArrowDown', 'ArrowUp', 'Control', 'Shift',
];

const MessageInput = ({
  ref,
  id,
  chatId,
  richEditor,
  tooltips,
  maxLength,
  isAttachmentModalInput,
  isStoryInput,
  editableInputId,
  isActive,
  placeholder,
  forcedPlaceholder,
  canSendPlainText,
  isRichInputExpanded,
  canAutoFocus,
  noFocusInterception,
  shouldSuppressFocus,
  replyInfo,
  isSelectModeActive,
  messageSendKeyCombo,
  isNeedPremium,
  isRichOnlyContent,
  messageListType,
  onRichInputCollapse,
  onRichInputExpand,
  onSuppressedFocus,
  onSend,
  onScroll,
  onFocus,
  onBlur,
}: OwnProps & StateProps) => {
  const {
    editLastMessage,
    replyToNextMessage,
    showAllowedMessageTypesNotification,
    openPremiumModal,
  } = getActions();

  let inputRef = useRef<HTMLDivElement>();
  if (ref) {
    inputRef = ref;
  }

  const cloneRef = useRef<HTMLDivElement>();
  const scrollerCloneRef = useRef<HTMLDivElement>();
  const sharedCanvasRef = useRef<HTMLCanvasElement>();
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>();
  const scrollerRef = useRef<HTMLDivElement>();
  const updateRafRef = useRef<number>();

  const oldLang = useOldLang();
  const lang = useLang();
  const onBlurRef = useStateRef(onBlur);
  const onFocusRef = useStateRef(onFocus);
  const isContextMenuOpenRef = useRef(false);
  const isTextFormatterDisabledRef = useRef(IS_ANDROID);
  const [dateEditTarget, setDateEditTarget] = useState<RichEditorDateClickTarget>();
  const [isDateEditorOpen, openDateEditor, closeDateEditor] = useFlag();
  const { isMobile } = useAppLayout();
  const isMobileDevice = isMobile && (IS_IOS || IS_ANDROID);
  const richValue = richEditor.value;
  const richValueRef = useStateRef(richValue);
  const isRichEditorReady = richEditor.isReady;
  const isInputEmpty = isRichEditorReady ? richEditor.isEmpty() : !richValue.blocks.length;

  const maxInputHeight = isAttachmentModalInput
    ? MAX_ATTACHMENT_MODAL_INPUT_HEIGHT
    : isStoryInput ? MAX_STORY_MODAL_INPUT_HEIGHT : MAX_MESSAGE_INPUT_HEIGHT;
  const isTouched = Boolean(isActive && !isInputEmpty);

  const className = buildClassName(
    'form-control allow-selection',
    isTouched && 'touched',
    shouldSuppressFocus && 'focus-disabled',
    !isRichInputExpanded && tiptapStyles.regularInput,
  );
  const inputScrollerContentClass = buildClassName('input-scroller-content', isNeedPremium && 'is-need-premium');
  const placeholderAriaLabel = typeof placeholder === 'string' ? placeholder : undefined;
  const canRenderRichEditor = Boolean(isAttachmentModalInput || canSendPlainText);
  const isMainInput = !isAttachmentModalInput && !isStoryInput;
  const hasUnsupportedRichContent = canRenderRichEditor && Boolean(richValue && hasUnsupportedRichBlocks(richValue));
  const isCollapsedRichOnlyPreview = Boolean(
    isMainInput
    && !isRichInputExpanded
    && isRichOnlyContent
    && !hasUnsupportedRichContent,
  );
  const isRichEditorEditable = isRichEditorReady && !isCollapsedRichOnlyPreview;
  useScrollableHint(scrollerRef, { isDisabled: !isRichInputExpanded });
  const registerRichEditorRoot = richEditor.registerRoot;
  const isMainInputLocked = !isAttachmentModalInput && !canSendPlainText;
  const editor = richEditor.editor;
  const getTooltipContext = useLastCallback(() => ({
    ...(tooltips?.getContext() || { chatId }),
    isRichInputExpanded,
    isFormatterDisabled: isTextFormatterDisabledRef.current,
    isFormatterContextMenuOpen: isContextMenuOpenRef.current,
  }));
  const getIsRootFormatterEnabled = useLastCallback(() => Boolean(
    tooltips?.formatter?.isEnabled()
    && isRichEditorEditable
    && !isCollapsedRichOnlyPreview,
  ));
  const rootTooltips = useMemo(() => (tooltips ? {
    ...tooltips,
    formatter: tooltips.formatter ? {
      ...tooltips.formatter,
      isEnabled: getIsRootFormatterEnabled,
    } : undefined,
    getContext: getTooltipContext,
  } : undefined), [getIsRootFormatterEnabled, getTooltipContext, tooltips]);
  const remainingLength = useMemo(() => {
    if (maxLength === undefined || !richValue) {
      return undefined;
    }

    return maxLength - getRichInputLength(richValue);
  }, [maxLength, richValue]);
  const canShowLengthIndicator = remainingLength !== undefined
    && remainingLength < MAX_REMAINING_LENGTH_TO_SHOW;

  const handleDateClick = useLastCallback((target: RichEditorDateClickTarget) => {
    setDateEditTarget(target);
    openDateEditor();
  });

  const handleCloseDateEditor = useLastCallback(() => {
    closeDateEditor();
  });

  const handleDateEditorAnimationEnd = useLastCallback(() => {
    setDateEditTarget(undefined);
  });

  const handleDateMarkSubmit = useLastCallback((date: Date) => {
    if (!editor || dateEditTarget?.type !== 'date') {
      return;
    }

    editor.chain()
      .focus()
      .setTextSelection(dateEditTarget.range)
      .setMark('date', { date: Math.round(date.getTime() / 1000) })
      .run();
    closeDateEditor();
  });

  const handleFormattedDateSubmit = useLastCallback((text: ApiFormattedText) => {
    if (dateEditTarget?.type !== 'formattedDate') {
      return;
    }

    richEditor.replaceRange(dateEditTarget.range, { type: 'formattedText', text });
    closeDateEditor();
  });

  const updateInputHeight = useLastCallback((willSend = false) => {
    // Defer to avoid animation/layout conflicts during DOM updates
    fastRaf(() => {
      requestForcedReflow(() => {
        const input = inputRef.current;
        const clone = scrollerCloneRef.current;
        if (!input || !clone) {
          return undefined;
        }

        const scroller = input.closest<HTMLDivElement>(`.${SCROLLER_CLASS}`);
        if (!scroller) {
          return undefined;
        }

        const currentScroller = scroller;
        const currentHeight = Number(currentScroller.style.height.replace('px', ''));
        const { scrollHeight } = clone;
        let heightLimit = maxInputHeight;
        if (isCollapsedRichOnlyPreview) {
          const baseHeight = Number.parseFloat(getComputedStyle(currentScroller).minHeight);
          const lineHeight = Number.parseFloat(getComputedStyle(input).lineHeight);
          heightLimit = baseHeight + lineHeight * (COLLAPSED_RICH_PREVIEW_LINE_COUNT - 1);
        }
        const newHeight = Math.min(scrollHeight, heightLimit);
        const isOverflown = scrollHeight > heightLimit;
        const isHeightChanged = newHeight !== currentHeight;

        function exec() {
          currentScroller.classList.toggle('overflown', isOverflown);

          if (!isHeightChanged) {
            return;
          }

          const transitionDuration = Math.round(
            TRANSITION_DURATION_FACTOR * Math.log(Math.abs(newHeight - currentHeight)),
          );
          currentScroller.style.height = `${newHeight}px`;
          currentScroller.style.transitionDuration = `${transitionDuration}ms`;
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
  });

  const syncCloneWithSource = useLastCallback((source?: HTMLElement) => {
    const clone = cloneRef.current;
    if (!source || !clone) {
      clone?.replaceChildren();
      return;
    }

    clone.replaceChildren(...Array.from(source.childNodes).map((child) => child.cloneNode(true)));
  });

  const handleEditorUpdate = useLastCallback((
    isEmpty: boolean,
    source: HTMLElement,
  ) => {
    if (updateRafRef.current) {
      cancelAnimationFrame(updateRafRef.current);
    }

    updateRafRef.current = requestAnimationFrame(() => {
      syncCloneWithSource(source);
      updateInputHeight(isEmpty);
    });
  });

  const wasRichOnlyContentRef = useRef(isRichOnlyContent);
  useEffect(() => {
    const shouldExpandRichInput = isMainInput
      && !isRichInputExpanded
      && isRichOnlyContent
      && !wasRichOnlyContentRef.current;
    wasRichOnlyContentRef.current = isRichOnlyContent;

    if (shouldExpandRichInput) {
      onRichInputExpand?.();
    }
  }, [isMainInput, isRichInputExpanded, isRichOnlyContent, onRichInputExpand]);

  const handleEditorReady = useLastCallback((source: HTMLElement) => {
    syncCloneWithSource(source);
    updateInputHeight();
  });

  const getIsRichInputExpanded = useLastCallback(() => Boolean(isMainInput && isRichInputExpanded));

  const syncEditorElementAttributes = useLastCallback((input: HTMLElement) => {
    input.id = editableInputId || EDITABLE_INPUT_ID;
    input.className = buildClassName(className, 'ProseMirror');
    input.inert = isCollapsedRichOnlyPreview;
    input.setAttribute('role', 'textbox');
    input.setAttribute('dir', 'auto');
    input.setAttribute('tabindex', isCollapsedRichOnlyPreview ? '-1' : '0');
    input.setAttribute('contenteditable', isRichEditorEditable ? 'true' : 'false');
    if (isCollapsedRichOnlyPreview) {
      input.setAttribute('aria-readonly', 'true');
    } else {
      input.removeAttribute('aria-readonly');
    }
    if (IS_TAURI) {
      input.setAttribute('spellcheck', 'false');
    } else {
      input.removeAttribute('spellcheck');
    }

    if (placeholderAriaLabel) {
      input.setAttribute('aria-label', placeholderAriaLabel);
    } else {
      input.removeAttribute('aria-label');
    }
  });

  useLayoutEffect(() => {
    if (!isAttachmentModalInput) return;
    updateInputHeight(false);
  }, [isAttachmentModalInput, updateInputHeight]);

  useLayoutEffect(() => {
    if (isRichInputExpanded) {
      return;
    }

    updateInputHeight(false);
  }, [isRichInputExpanded, updateInputHeight]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return undefined;
    }

    if (!canRenderRichEditor || !isActive) {
      if (!canRenderRichEditor) {
        input.replaceChildren();
      }
      syncCloneWithSource();
      updateInputHeight();
      return undefined;
    }

    syncEditorElementAttributes(input);
    const unregisterRichEditorRoot = registerRichEditorRoot({
      element: input,
      sharedCanvasRef,
      sharedCanvasHqRef,
      tooltips: rootTooltips,
      getIsRichInputExpanded,
      onReady: handleEditorReady,
      onUpdate: handleEditorUpdate,
      onDateClick: handleDateClick,
    });

    return () => {
      if (updateRafRef.current) {
        cancelAnimationFrame(updateRafRef.current);
      }
      unregisterRichEditorRoot();
    };
  }, [canRenderRichEditor, getIsRichInputExpanded, handleDateClick, handleEditorReady, handleEditorUpdate,
    isActive, registerRichEditorRoot, richValueRef, rootTooltips,
    syncCloneWithSource, syncEditorElementAttributes, updateInputHeight]);

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed || !isMainInput || !isActive) {
      return;
    }

    editor.view.dispatch(editor.state.tr
      .setMeta(RICH_INPUT_MODE_CHANGED_META, true)
      .setMeta('addToHistory', false));
    editor.setEditable(!isCollapsedRichOnlyPreview, false);
    syncEditorElementAttributes(editor.view.dom);
  }, [editor, isActive, isCollapsedRichOnlyPreview, isMainInput, isRichInputExpanded,
    syncEditorElementAttributes]);

  const refreshCodeBlockHighlighting = useLastCallback(() => {
    requestMutation(() => {
      if (!editor || editor.isDestroyed) {
        return;
      }

      const transaction = editor.state.tr
        .setMeta('addToHistory', false)
        .setMeta('preventUpdate', true);
      const { from, to } = editor.state.selection;

      editor.state.doc.descendants((node, position) => {
        if (node.type.name !== 'codeBlock') {
          return true;
        }

        transaction.replaceWith(position, position + node.nodeSize, node);
        return false;
      });

      if (!transaction.docChanged) {
        return;
      }

      const docSize = transaction.doc.content.size;
      transaction.setSelection(TextSelection.create(
        transaction.doc,
        Math.min(from, docSize),
        Math.min(to, docSize),
      ));
      editor.view.dispatch(transaction);
      syncCloneWithSource(editor.view.dom);
      updateInputHeight();
    });
  });

  useEffect(() => {
    return subscribeToCodeLanguageLoad(refreshCodeBlockHighlighting);
  }, [refreshCodeBlockHighlighting]);

  useLayoutEffect(() => {
    if (!isActive && inputRef.current) {
      inputRef.current.blur();
      updateInputHeight(true);
      return;
    }

    if (isRichEditorReady && editor && !editor.isDestroyed) {
      syncCloneWithSource(editor.view.dom);
    }

    updateInputHeight(isInputEmpty);
  }, [editor, isActive, isInputEmpty, isRichEditorReady, richValue, syncCloneWithSource, updateInputHeight]);

  useLayoutEffect(() => {
    if (!inputRef.current || !canRenderRichEditor) {
      return;
    }

    syncEditorElementAttributes(inputRef.current);
  }, [canRenderRichEditor, className, editableInputId, isCollapsedRichOnlyPreview, isNeedPremium,
    isRichEditorEditable, placeholderAriaLabel, syncEditorElementAttributes]);

  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const focusInput = useLastCallback(() => {
    if (
      !inputRef.current
      || !canRenderRichEditor
      || !isRichEditorReady
      || isCollapsedRichOnlyPreview
      || isNeedPremium
    ) {
      return;
    }

    focusEditableElement(inputRef.current);
  });

  const handleDebugDoubleClick = useLastCallback(() => {
    if (!DEBUG) {
      return;
    }

    // eslint-disable-next-line no-console
    console.warn('[MessageInput] Tiptap state:', editor, editor?.getJSON());
  });

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (e.button !== 2) {
      return;
    }

    if (isContextMenuOpenRef.current) {
      return;
    }

    isContextMenuOpenRef.current = true;
    if (editor && !editor.isDestroyed) {
      refreshRichEditorTooltips(editor);
    }

    function handleCloseContextMenu(e2: KeyboardEvent | MouseEvent) {
      if (e2 instanceof KeyboardEvent && e2.key !== 'Esc' && e2.key !== 'Escape') {
        return;
      }

      setTimeout(() => {
        isContextMenuOpenRef.current = false;
        if (editor && !editor.isDestroyed) {
          refreshRichEditorTooltips(editor);
        }
      }, CONTEXT_MENU_CLOSE_DELAY_MS);

      window.removeEventListener('keydown', handleCloseContextMenu);
      window.removeEventListener('mousedown', handleCloseContextMenu);
    }

    document.addEventListener('mousedown', handleCloseContextMenu);
    document.addEventListener('keydown', handleCloseContextMenu);
  }

  const isSendShortcut = useLastCallback((e: KeyboardEvent | React.KeyboardEvent<HTMLDivElement>) => {
    const isEnterKey = e.key === 'Enter';
    const isSubmitModifierPressed = e.ctrlKey || e.metaKey;

    if (!isEnterKey || e.shiftKey || isMobileDevice) {
      return false;
    }

    if (isRichInputExpanded) {
      return isSubmitModifierPressed;
    }

    return messageSendKeyCombo === 'enter'
      || (messageSendKeyCombo === 'ctrl-enter' && isSubmitModifierPressed);
  });

  const handleSendShortcut = useLastCallback((e: KeyboardEvent | React.KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onSend();
  });

  function handleKeyDownCapture(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!(e.target instanceof Node) || !inputRef.current?.contains(e.target)) {
      return;
    }

    // Capture send shortcuts before ProseMirror handles them as editor commands
    if (!e.isComposing && isSendShortcut(e)) {
      handleSendShortcut(e);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const { isComposing } = e;

    const isEmpty = richEditor.isEmpty();
    if (!isComposing && isEmpty && (e.metaKey || e.ctrlKey)) {
      const targetIndexDelta = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : undefined;
      if (targetIndexDelta) {
        e.preventDefault();

        replyToNextMessage({ targetIndexDelta });
        return;
      }
    }

    if (!isComposing && e.key === 'Escape' && isRichInputExpanded) {
      onRichInputCollapse?.();
    } else if (!isComposing && e.key === 'ArrowUp' && isEmpty && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      editLastMessage();
    }
  }

  function handleAndroidContextMenu(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!editor || editor.isDestroyed || editor.state.selection.empty) {
      return;
    }

    isTextFormatterDisabledRef.current = !isTextFormatterDisabledRef.current;

    if (!isTextFormatterDisabledRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
    refreshRichEditorTooltips(editor);
  }

  function handleClick() {
    if (isAttachmentModalInput || canSendPlainText || (isStoryInput && isNeedPremium)) return;
    showAllowedMessageTypesNotification({ chatId, messageListType });
  }

  const handleOpenPremiumModal = useLastCallback(() => openPremiumModal());

  function handleDeleteUnsupported() {
    if (!richValue) {
      return;
    }

    const nextValue = removeUnsupportedRichBlocks(richValue);
    richEditor.setValue(nextValue.blocks.length ? nextValue : undefined);
    syncCloneWithSource(editor?.view.dom);
  }

  useEffect(() => {
    if (IS_TOUCH_ENV) {
      return;
    }

    if (canAutoFocus) {
      focusInput();
    }
  }, [chatId, focusInput, replyInfo, canAutoFocus, isRichEditorReady]);

  useEffect(() => {
    if (
      !chatId
      || (editableInputId !== EDITABLE_INPUT_ID && editableInputId !== EDITABLE_INPUT_MODAL_ID)
      || isMobileDevice
      || isSelectModeActive
    ) {
      return undefined;
    }

    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | undefined;
      const input = inputRef.current!;

      const shouldHandleDocumentKeyDown =
        canRenderRichEditor
        && !isCollapsedRichOnlyPreview
        && isActive && input && target
        && target !== input
        && target.tagName !== 'INPUT'
        && target.tagName !== 'TEXTAREA'
        && !target.isContentEditable
        && !hasActiveHandler('Enter');

      if (!shouldHandleDocumentKeyDown) return;

      if (isSendShortcut(e)) {
        handleSendShortcut(e);
        return;
      }

      const { key } = e;
      if (noFocusInterception || getIsDirectTextInputDisabled() || IGNORE_KEYS.includes(key)) {
        return;
      }

      const isSelectionCollapsed = document.getSelection()?.isCollapsed;

      if (
        ((key.startsWith('Arrow') || (e.shiftKey && key === 'Shift')) && !isSelectionCollapsed)
        || (e.code === 'KeyC' && (e.ctrlKey || e.metaKey) && target.tagName !== 'INPUT')
      ) {
        return;
      }

      focusEditableElement(input, true, true);

      const newEvent = new KeyboardEvent(e.type, e);
      input.dispatchEvent(newEvent);
    };

    document.addEventListener('keydown', handleDocumentKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
    };
  }, [canRenderRichEditor, chatId, editableInputId, isCollapsedRichOnlyPreview, isMobileDevice,
    isActive, isSelectModeActive, noFocusInterception]);

  useEffect(() => {
    const captureFirstTab = debounce((e: KeyboardEvent) => {
      if (e.key === 'Tab' && !getIsDirectTextInputDisabled()) {
        e.preventDefault();
        requestMutation(focusInput);
      }
    }, TAB_INDEX_PRIORITY_TIMEOUT, true, false);

    function handleTab(e: KeyboardEvent) {
      const target = e.target as HTMLElement | undefined;
      if (target?.closest?.(CONTENT_EDITABLE_SELECTOR)) {
        return false;
      }

      captureFirstTab(e);
      return undefined;
    }

    return captureKeyboardListeners({ onTab: handleTab });
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

  return (
    <div
      id={id}
      onClick={shouldSuppressFocus ? onSuppressedFocus : undefined}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {hasUnsupportedRichContent && (
        <div className={tiptapStyles.unsupported}>
          <span>{lang('PageContentUnsupported')}</span>
          <Button
            isText
            size="smaller"
            color="danger"
            className={tiptapStyles.unsupportedDelete}
            onClick={handleDeleteUnsupported}
          >
            {lang('Delete')}
          </Button>
        </div>
      )}
      <div className="shared-canvas-container">
        {canRenderRichEditor && (
          <>
            <canvas ref={sharedCanvasRef} className="shared-canvas" />
            <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          </>
        )}
        <div
          ref={scrollerRef}
          className={buildClassName(
            'custom-scroll',
            SCROLLER_CLASS,
            isNeedPremium && 'is-need-premium',
            isCollapsedRichOnlyPreview && 'rich-only-preview',
          )}
          onScroll={onScroll}
          onClick={isCollapsedRichOnlyPreview ? onRichInputExpand : isMainInputLocked ? handleClick : undefined}
        >
          <div
            className={inputScrollerContentClass}
            data-stricterdom-ignore
            onKeyDownCapture={handleKeyDownCapture}
          >
            <div
              ref={inputRef}
              id={editableInputId || EDITABLE_INPUT_ID}
              className={className}
              contentEditable={canRenderRichEditor && isRichEditorEditable}
              role="textbox"
              aria-disabled={canRenderRichEditor && !isRichEditorReady}
              aria-readonly={isCollapsedRichOnlyPreview || undefined}
              dir="auto"
              spellCheck={IS_TAURI ? false : undefined}
              tabIndex={isCollapsedRichOnlyPreview ? -1 : 0}
              onClick={isCollapsedRichOnlyPreview ? undefined : focusInput}
              onDoubleClick={DEBUG ? handleDebugDoubleClick : undefined}
              onKeyDown={handleKeyDown}
              onMouseDown={handleMouseDown}
              onContextMenu={IS_ANDROID ? handleAndroidContextMenu : undefined}
              aria-label={placeholderAriaLabel}
              onFocus={!isNeedPremium ? onFocusRef.current : undefined}
              onBlur={!isNeedPremium ? onBlurRef.current : undefined}
            />
            {!forcedPlaceholder && (
              <span
                className={buildClassName(
                  'placeholder-text',
                  isMainInputLocked && 'with-icon',
                  isNeedPremium && 'is-need-premium',
                )}
                dir="auto"
              >
                {isMainInputLocked && <Icon name="lock-badge" className="placeholder-icon" />}
                {placeholder}
                {isStoryInput && isNeedPremium && (
                  <Button className="unlock-button" size="tiny" color="adaptive" onClick={handleOpenPremiumModal}>
                    {oldLang('StoryRepliesLockedButton')}
                  </Button>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      <div
        ref={scrollerCloneRef}
        aria-hidden
        className={buildClassName('custom-scroll',
          SCROLLER_CLASS,
          'clone',
          isNeedPremium && 'is-need-premium')}
      >
        <div className={inputScrollerContentClass} data-stricterdom-ignore>
          <div ref={cloneRef} className={buildClassName(className, 'clone', tiptapStyles.clone)} dir="auto" />
        </div>
      </div>
      {canShowLengthIndicator && (
        <div
          className={buildClassName('max-length-indicator', remainingLength < 0 && 'color-danger')}
          dir="auto"
        >
          <AnimatedCounter text={remainingLength.toString()} />
        </div>
      )}
      {isMainInput && canRenderRichEditor && (
        <RichEditorToolbar editor={editor} isEnabled={isRichInputExpanded} />
      )}
      {dateEditTarget?.type === 'date' && (
        <CalendarModal
          isOpen={isDateEditorOpen}
          selectedAt={dateEditTarget.date * 1000}
          withTimePicker
          submitButtonLabel={lang('Save')}
          onClose={handleCloseDateEditor}
          onCloseAnimationEnd={handleDateEditorAnimationEnd}
          onSubmit={handleDateMarkSubmit}
        />
      )}
      {dateEditTarget?.type === 'formattedDate' && (
        <FormattedDateModal
          isOpen={isDateEditorOpen}
          initialDate={dateEditTarget.date}
          initialOptions={dateEditTarget.options}
          onClose={handleCloseDateEditor}
          onCloseAnimationEnd={handleDateEditorAnimationEnd}
          onSubmit={handleFormattedDateSubmit}
        />
      )}
      {forcedPlaceholder && <span className="forced-placeholder">{renderText(forcedPlaceholder)}</span>}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }: OwnProps): Complete<StateProps> => {
    const { messageSendKeyCombo } = selectSharedSettings(global);

    return {
      messageSendKeyCombo,
      replyInfo: chatId && threadId ? selectDraft(global, chatId, threadId)?.replyInfo : undefined,
      isSelectModeActive: selectIsInSelectMode(global),
    };
  },
)(MessageInput));

function getRichInputLength(value: ApiInputRichMessage) {
  const formattedValue = getRichInputAsFormatted(value);
  if (formattedValue) {
    return getUtf8Length(formattedValue.text);
  }

  return getRichMessageUsage(value).textLength;
}
