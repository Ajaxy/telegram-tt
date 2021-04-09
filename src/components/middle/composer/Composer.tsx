import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions, GlobalState, MessageListType } from '../../../global/types';
import {
  ApiAttachment,
  ApiSticker,
  ApiVideo,
  ApiNewPoll,
  ApiMessage,
  ApiFormattedText,
  ApiChat,
  ApiChatMember,
  ApiUser,
  MAIN_THREAD_ID,
} from '../../../api/types';

import { EDITABLE_INPUT_ID, SCHEDULED_WHEN_ONLINE } from '../../../config';
import { IS_EMOJI_SUPPORTED, IS_VOICE_RECORDING_SUPPORTED, IS_MOBILE_SCREEN } from '../../../util/environment';
import {
  selectChat,
  selectIsChatWithBot,
  selectIsRightColumnShown,
  selectIsInSelectMode,
  selectNewestMessageWithBotKeyboardButtons,
  selectDraft,
  selectScheduledIds,
  selectEditingMessage,
  selectIsChatWithSelf,
  selectChatUser,
} from '../../../modules/selectors';
import {
  getAllowedAttachmentOptions,
  getChatSlowModeOptions,
  isChatGroup,
  isChatPrivate,
  isChatAdmin,
} from '../../../modules/helpers';
import { formatVoiceRecordDuration, getDayStartAt } from '../../../util/dateFormat';
import focusEditableElement from '../../../util/focusEditableElement';
import parseMessageInput from './helpers/parseMessageInput';
import buildAttachment from './helpers/buildAttachment';
import renderText from '../../common/helpers/renderText';
import insertHtmlInSelection from '../../../util/insertHtmlInSelection';
import deleteLastCharacterOutsideSelection from '../../../util/deleteLastCharacterOutsideSelection';
import { pick } from '../../../util/iteratees';
import buildClassName from '../../../util/buildClassName';
import { isSelectionInsideInput } from './helpers/selection';

import useFlag from '../../../hooks/useFlag';
import useVoiceRecording from './hooks/useVoiceRecording';
import useClipboardPaste from './hooks/useClipboardPaste';
import useDraft from './hooks/useDraft';
import useEditing from './hooks/useEditing';
import usePrevious from '../../../hooks/usePrevious';
import useEmojiTooltip from './hooks/useEmojiTooltip';
import useMentionMenu from './hooks/useMentionMenu';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useLang from '../../../hooks/useLang';

import DeleteMessageModal from '../../common/DeleteMessageModal.async';
import Button from '../../ui/Button';
import ResponsiveHoverButton from '../../ui/ResponsiveHoverButton';
import Spinner from '../../ui/Spinner';
import AttachMenu from './AttachMenu.async';
import SymbolMenu from './SymbolMenu.async';
import MentionMenu from './MentionMenu.async';
import CustomSendMenu from './CustomSendMenu.async';
import EmojiTooltip from './EmojiTooltip.async';
import BotKeyboardMenu from './BotKeyboardMenu.async';
import MessageInput from './MessageInput';
import ComposerEmbeddedMessage from './ComposerEmbeddedMessage';
import AttachmentModal from './AttachmentModal.async';
import PollModal from './PollModal.async';
import DropArea, { DropAreaState } from './DropArea.async';
import WebPagePreview from './WebPagePreview';
import Portal from '../../ui/Portal';
import CalendarModal from '../../common/CalendarModal.async';
import PaymentModal from '../../payment/PaymentModal.async';
import ReceiptModal from '../../payment/ReceiptModal.async';

import './Composer.scss';

type OwnProps = {
  chatId: number;
  threadId: number;
  messageListType: MessageListType;
  dropAreaState: string;
  onDropHide: NoneToVoidFunction;
};

type StateProps = {
  editingMessage?: ApiMessage;
  chat?: ApiChat;
  draft?: ApiFormattedText;
  isChatWithBot?: boolean;
  isChatWithSelf?: boolean;
  isRightColumnShown?: boolean;
  isSelectModeActive?: boolean;
  isForwarding?: boolean;
  canSuggestMembers?: boolean;
  isPollModalOpen?: boolean;
  isPaymentModalOpen?: boolean;
  isReceiptModalOpen?: boolean;
  botKeyboardMessageId?: number;
  withScheduledButton?: boolean;
  shouldSchedule?: boolean;
  canScheduleUntilOnline?: boolean;
  stickersForEmoji?: ApiSticker[];
  groupChatMembers?: ApiChatMember[];
  currentUserId?: number;
  usersById?: Record<number, ApiUser>;
  lastSyncTime?: number;
  contentToBeScheduled?: GlobalState['messages']['contentToBeScheduled'];
  shouldSuggestStickers?: boolean;
} & Pick<GlobalState, 'connectionState'>;

type DispatchProps = Pick<GlobalActions, (
  'sendMessage' | 'editMessage' | 'saveDraft' | 'forwardMessages' |
  'clearDraft' | 'showError' | 'setStickerSearchQuery' | 'setGifSearchQuery' |
  'openPollModal' | 'closePollModal' | 'loadScheduledHistory' | 'openChat' | 'closePaymentModal' |
  'clearReceipt'
)>;

enum MainButtonState {
  Send = 'send',
  Record = 'record',
  Edit = 'edit',
}

const VOICE_RECORDING_FILENAME = 'wonderful-voice-message.ogg';
// When voice recording is active, composer placeholder will hide to prevent overlapping
const SCREEN_WIDTH_TO_HIDE_PLACEHOLDER = 600; // px

const MOBILE_KEYBOARD_HIDE_DELAY_MS = 100;
const SELECT_MODE_TRANSITION_MS = 200;
const CAPTION_MAX_LENGTH = 1024;
const SENDING_ANIMATION_DURATION = 350;

const Composer: FC<OwnProps & StateProps & DispatchProps> = ({
  dropAreaState,
  shouldSchedule,
  canScheduleUntilOnline,
  onDropHide,
  editingMessage,
  chatId,
  threadId,
  messageListType,
  draft,
  chat,
  connectionState,
  isChatWithBot,
  isChatWithSelf,
  isRightColumnShown,
  isSelectModeActive,
  isForwarding,
  canSuggestMembers,
  isPollModalOpen,
  isPaymentModalOpen,
  isReceiptModalOpen,
  botKeyboardMessageId,
  withScheduledButton,
  stickersForEmoji,
  groupChatMembers,
  currentUserId,
  usersById,
  lastSyncTime,
  contentToBeScheduled,
  shouldSuggestStickers,
  sendMessage,
  editMessage,
  saveDraft,
  clearDraft,
  showError,
  setStickerSearchQuery,
  setGifSearchQuery,
  forwardMessages,
  openPollModal,
  closePollModal,
  loadScheduledHistory,
  closePaymentModal,
  openChat,
  clearReceipt,
}) => {
  const [html, setHtml] = useState<string>('');
  const lastMessageSendTimeSeconds = useRef<number>();
  const prevDropAreaState = usePrevious(dropAreaState);
  const [isCalendarOpen, openCalendar, closeCalendar] = useFlag();
  const [
    scheduledMessageArgs, setScheduledMessageArgs,
  ] = useState<GlobalState['messages']['contentToBeScheduled'] | undefined>();

  // Cache for frequently updated state
  const htmlRef = useRef<string>(html);
  useEffect(() => {
    htmlRef.current = html;
  }, [html]);

  useEffect(() => {
    lastMessageSendTimeSeconds.current = undefined;
  }, [chatId]);

  useEffect(() => {
    if (chatId && lastSyncTime && threadId === MAIN_THREAD_ID) {
      loadScheduledHistory();
    }
  }, [chatId, loadScheduledHistory, lastSyncTime, threadId]);

  useEffect(() => {
    if (contentToBeScheduled) {
      setScheduledMessageArgs(contentToBeScheduled);
      openCalendar();
    }
  }, [contentToBeScheduled, openCalendar]);

  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);

  const [isBotKeyboardOpen, openBotKeyboard, closeBotKeyboard] = useFlag();
  const [isAttachMenuOpen, openAttachMenu, closeAttachMenu] = useFlag();
  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag();
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isSymbolMenuLoaded, onSymbolMenuLoadingComplete] = useFlag();
  const [isHoverDisabled, disableHover, enableHover] = useFlag();

  const {
    startRecordingVoice,
    stopRecordingVoice,
    pauseRecordingVoice,
    activeVoiceRecording,
    currentRecordTime,
    recordButtonRef: mainButtonRef,
    startRecordTimeRef,
  } = useVoiceRecording();

  const mainButtonState = editingMessage
    ? MainButtonState.Edit
    : !IS_VOICE_RECORDING_SUPPORTED || activeVoiceRecording || (html && !attachments.length) || isForwarding
      ? MainButtonState.Send
      : MainButtonState.Record;
  const canShowCustomSendMenu = !shouldSchedule;

  const {
    isMentionMenuOpen, mentionFilter,
    closeMentionMenu, insertMention,
    mentionFilteredMembers,
  } = useMentionMenu(
    canSuggestMembers && !attachments.length,
    html,
    setHtml,
    undefined,
    groupChatMembers,
    currentUserId,
    usersById,
  );

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !(mainButtonState === MainButtonState.Send && canShowCustomSendMenu));

  const allowedAttachmentOptions = useMemo(() => {
    return getAllowedAttachmentOptions(chat, isChatWithBot);
  }, [chat, isChatWithBot]);

  const isAdmin = chat && isChatAdmin(chat);
  const slowMode = getChatSlowModeOptions(chat);

  const { isEmojiTooltipOpen, closeEmojiTooltip } = useEmojiTooltip(
    Boolean(shouldSuggestStickers && allowedAttachmentOptions.canSendStickers && !attachments.length),
    html,
    stickersForEmoji,
  );

  const insertTextAndUpdateCursor = useCallback((text: string) => {
    const selection = window.getSelection()!;
    const messageInput = document.getElementById(EDITABLE_INPUT_ID)!;
    const newHtml = renderText(text, ['escape_html', 'emoji_html', 'br_html'])
      .join('')
      .replace(/\u200b+/g, '\u200b');
    if (selection.rangeCount) {
      const selectionRange = selection.getRangeAt(0);
      if (isSelectionInsideInput(selectionRange)) {
        if (IS_EMOJI_SUPPORTED) {
          // Insertion will trigger `onChange` in MessageInput, so no need to setHtml in state
          document.execCommand('insertText', false, text);
        } else {
          insertHtmlInSelection(newHtml);
          messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        return;
      }

      setHtml(`${htmlRef.current!}${newHtml}`);

      if (!IS_MOBILE_SCREEN) {
        // If selection is outside of input, set cursor at the end of input
        requestAnimationFrame(() => {
          focusEditableElement(messageInput);
        });
      }
    } else if (IS_MOBILE_SCREEN) {
      setHtml(`${htmlRef.current!}${newHtml}`);
    }
  }, []);

  const removeSymbol = useCallback(() => {
    const selection = window.getSelection()!;

    if (selection.rangeCount) {
      const selectionRange = selection.getRangeAt(0);
      if (isSelectionInsideInput(selectionRange)) {
        document.execCommand('delete', false);
        return;
      }
    }

    setHtml(deleteLastCharacterOutsideSelection(htmlRef.current!));
  }, []);

  const resetComposer = useCallback(() => {
    setHtml('');
    setAttachments([]);
    closeEmojiTooltip();
    closeCalendar();
    setScheduledMessageArgs(undefined);
    closeMentionMenu();

    if (IS_MOBILE_SCREEN) {
      // @perf
      setTimeout(() => closeSymbolMenu(), SENDING_ANIMATION_DURATION);
    } else {
      closeSymbolMenu();
    }
  }, [closeEmojiTooltip, closeCalendar, closeMentionMenu, closeSymbolMenu]);

  // Handle chat change
  const prevChatId = usePrevious(chatId);
  useEffect(() => {
    if (!prevChatId || chatId === prevChatId) {
      return;
    }

    stopRecordingVoice();
    resetComposer();
  }, [chatId, prevChatId, resetComposer, stopRecordingVoice]);

  const handleEditComplete = useEditing(htmlRef, setHtml, editingMessage, resetComposer, openDeleteModal, editMessage);
  useDraft(draft, chatId, threadId, html, htmlRef, setHtml, editingMessage, saveDraft, clearDraft);
  useClipboardPaste(insertTextAndUpdateCursor, setAttachments, editingMessage);

  const handleFileSelect = useCallback(async (files: File[], isQuick: boolean) => {
    setAttachments(await Promise.all(files.map((file) => buildAttachment(file.name, file, isQuick))));
  }, []);

  const handleClearAttachment = useCallback(() => {
    setAttachments([]);
  }, []);

  const handleSend = useCallback(async (isSilent = false, scheduledAt?: number) => {
    if (connectionState !== 'connectionStateReady') {
      return;
    }

    let currentAttachments = attachments;

    if (activeVoiceRecording) {
      const record = await stopRecordingVoice();
      if (record) {
        const { blob, duration, waveform } = record;
        currentAttachments = [await buildAttachment(
          VOICE_RECORDING_FILENAME,
          blob,
          false,
          { voice: { duration, waveform } },
        )];
      }
    }

    const { text, entities } = parseMessageInput(htmlRef.current!);
    if (!currentAttachments.length && !text && !isForwarding) {
      return;
    }

    if (currentAttachments.length && text && text.length > CAPTION_MAX_LENGTH) {
      const extraLength = text.length - CAPTION_MAX_LENGTH;
      showError({
        error: {
          message: 'CAPTION_TOO_LONG_PLEASE_REMOVE_CHARACTERS',
          textParams: {
            '{EXTRA_CHARS_COUNT}': extraLength,
            '{PLURAL_S}': extraLength > 1 ? 's' : '',
          },
        },
      });
      return;
    }

    if (currentAttachments.length || text) {
      if (slowMode && !isAdmin) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const secondsSinceLastMessage = lastMessageSendTimeSeconds.current
          && Math.floor(nowSeconds - lastMessageSendTimeSeconds.current);
        const nextSendDateNotReached = slowMode.nextSendDate && slowMode.nextSendDate > nowSeconds;

        if (
          (secondsSinceLastMessage && secondsSinceLastMessage < slowMode.seconds)
          || nextSendDateNotReached
        ) {
          const secondsRemaining = nextSendDateNotReached
            ? slowMode.nextSendDate! - nowSeconds
            : slowMode.seconds - secondsSinceLastMessage!;
          showError({
            error: {
              message: `A wait of ${secondsRemaining} seconds is required before sending another message in this chat`,
              isSlowMode: true,
            },
          });

          const messageInput = document.getElementById(EDITABLE_INPUT_ID)!;
          messageInput.blur();

          return;
        }
      }

      sendMessage({
        text,
        entities,
        attachments: currentAttachments,
        scheduledAt,
        isSilent,
      });
    }
    if (isForwarding) {
      forwardMessages();
    }

    lastMessageSendTimeSeconds.current = Math.floor(Date.now() / 1000);

    clearDraft({ chatId, localOnly: true });

    // Wait until message animation starts
    requestAnimationFrame(resetComposer);
  }, [
    activeVoiceRecording, attachments, connectionState, chatId, slowMode, isForwarding, isAdmin,
    sendMessage, stopRecordingVoice, resetComposer, clearDraft, showError, forwardMessages,
  ]);

  const handleStickerSelect = useCallback((sticker: ApiSticker) => {
    sticker = {
      ...sticker,
      isPreloadedGlobally: true,
    };

    if (shouldSchedule) {
      setScheduledMessageArgs({ sticker });
      openCalendar();
    } else {
      sendMessage({ sticker });
      requestAnimationFrame(resetComposer);
    }
  }, [shouldSchedule, openCalendar, sendMessage, resetComposer]);

  const handleGifSelect = useCallback((gif: ApiVideo) => {
    if (shouldSchedule) {
      setScheduledMessageArgs({ gif });
      openCalendar();
    } else {
      sendMessage({ gif });
      requestAnimationFrame(resetComposer);
    }
  }, [shouldSchedule, openCalendar, sendMessage, resetComposer]);

  const handlePollSend = useCallback((poll: ApiNewPoll) => {
    if (shouldSchedule) {
      setScheduledMessageArgs({ poll });
      closePollModal();
      openCalendar();
    } else {
      sendMessage({ poll });
      closePollModal();
    }
  }, [closePollModal, openCalendar, sendMessage, shouldSchedule]);

  const handleSilentSend = useCallback(() => {
    if (shouldSchedule) {
      setScheduledMessageArgs({ isSilent: true });
      openCalendar();
    } else {
      handleSend(true);
    }
  }, [handleSend, openCalendar, shouldSchedule]);

  const handleMessageSchedule = useCallback((date: Date) => {
    const { isSilent, ...restArgs } = scheduledMessageArgs || {};

    // Scheduled time can not be less than 10 seconds in future
    const scheduledAt = Math.round(Math.max(date.getTime(), Date.now() + 60 * 1000) / 1000);

    if (!scheduledMessageArgs || Object.keys(restArgs).length === 0) {
      handleSend(!!isSilent, scheduledAt);
    } else {
      sendMessage({
        ...scheduledMessageArgs,
        scheduledAt,
      });
      requestAnimationFrame(resetComposer);
    }
    closeCalendar();
  }, [closeCalendar, handleSend, resetComposer, scheduledMessageArgs, sendMessage]);

  const handleMessageScheduleUntilOnline = useCallback(() => {
    handleMessageSchedule(new Date(SCHEDULED_WHEN_ONLINE * 1000));
  }, [handleMessageSchedule]);

  const handleCloseCalendar = useCallback(() => {
    closeCalendar();
    setScheduledMessageArgs(undefined);
  }, [closeCalendar]);

  const handleSearchOpen = useCallback((type: 'stickers' | 'gifs') => {
    if (type === 'stickers') {
      setStickerSearchQuery({ query: '' });
      setGifSearchQuery({ query: undefined });
    } else {
      setGifSearchQuery({ query: '' });
      setStickerSearchQuery({ query: undefined });
    }
  }, [setStickerSearchQuery, setGifSearchQuery]);

  const handleSymbolMenuOpen = useCallback(() => {
    const messageInput = document.getElementById(EDITABLE_INPUT_ID)!;

    if (!IS_MOBILE_SCREEN || messageInput !== document.activeElement) {
      openSymbolMenu();
      return;
    }

    messageInput.blur();
    setTimeout(() => {
      openSymbolMenu();
    }, MOBILE_KEYBOARD_HIDE_DELAY_MS);
  }, [openSymbolMenu]);

  const handleAllScheduledClick = useCallback(() => {
    openChat({ id: chatId, threadId, type: 'scheduled' });
  }, [openChat, chatId, threadId]);

  useEffect(() => {
    if (isRightColumnShown && IS_MOBILE_SCREEN) {
      closeSymbolMenu();
    }
  }, [isRightColumnShown, closeSymbolMenu]);

  useEffect(() => {
    if (isSelectModeActive) {
      disableHover();
    } else {
      setTimeout(() => {
        enableHover();
      }, SELECT_MODE_TRANSITION_MS);
    }
  }, [isSelectModeActive, enableHover, disableHover]);

  const mainButtonHandler = useCallback(() => {
    switch (mainButtonState) {
      case MainButtonState.Send:
        if (shouldSchedule) {
          if (activeVoiceRecording) {
            pauseRecordingVoice();
          }
          openCalendar();
        } else {
          handleSend();
          requestAnimationFrame(resetComposer);
        }
        break;
      case MainButtonState.Record:
        startRecordingVoice();
        break;
      case MainButtonState.Edit:
        handleEditComplete();
        break;
      default:
        break;
    }
  }, [
    mainButtonState, resetComposer, shouldSchedule, startRecordingVoice, handleEditComplete,
    activeVoiceRecording, openCalendar, pauseRecordingVoice, handleSend,
  ]);

  const lang = useLang();

  const areVoiceMessagesNotAllowed = mainButtonState === MainButtonState.Record
    && !allowedAttachmentOptions.canAttachMedia;

  const prevEditedMessage = usePrevious(editingMessage, true);
  const renderedEditedMessage = editingMessage || prevEditedMessage;

  const scheduledDefaultDate = new Date();
  scheduledDefaultDate.setSeconds(0);
  scheduledDefaultDate.setMilliseconds(0);

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  let sendButtonAriaLabel = 'Send message';
  switch (mainButtonState) {
    case MainButtonState.Edit:
      sendButtonAriaLabel = 'Save edited message';
      break;
    case MainButtonState.Record:
      sendButtonAriaLabel = areVoiceMessagesNotAllowed
        ? 'Posting media content is not allowed in this group.'
        : 'Record a voice message';
  }

  const className = buildClassName(
    'Composer',
    !isSelectModeActive && 'shown',
    isHoverDisabled && 'hover-disabled',
  );

  const symbolMenuButtonClassName = buildClassName(
    'mobile-symbol-menu-button',
    isSymbolMenuLoaded
      ? (isSymbolMenuOpen && 'menu-opened')
      : (isSymbolMenuOpen && 'is-loading'),
  );

  return (
    <div className={className}>
      {allowedAttachmentOptions.canAttachMedia && (
        <Portal containerId="#middle-column-portals">
          <DropArea
            isOpen={dropAreaState !== DropAreaState.None}
            withQuick={[dropAreaState, prevDropAreaState].includes(DropAreaState.QuickFile)}
            onHide={onDropHide}
            onFileSelect={handleFileSelect}
          />
        </Portal>
      )}
      <AttachmentModal
        attachments={attachments}
        caption={attachments.length ? html : ''}
        canSuggestMembers={canSuggestMembers}
        groupChatMembers={groupChatMembers}
        currentUserId={currentUserId}
        usersById={usersById}
        onCaptionUpdate={setHtml}
        onSend={shouldSchedule ? openCalendar : handleSend}
        onClear={handleClearAttachment}
      />
      <PollModal
        isOpen={Boolean(isPollModalOpen)}
        onClear={closePollModal}
        onSend={handlePollSend}
      />
      <PaymentModal
        isOpen={Boolean(isPaymentModalOpen)}
        onClose={closePaymentModal}
      />
      <ReceiptModal
        isOpen={Boolean(isReceiptModalOpen)}
        onClose={clearReceipt}
      />
      {renderedEditedMessage && (
        <DeleteMessageModal
          isOpen={isDeleteModalOpen}
          isSchedule={messageListType === 'scheduled'}
          onClose={closeDeleteModal}
          message={renderedEditedMessage}
        />
      )}
      <MentionMenu
        isOpen={isMentionMenuOpen}
        filter={mentionFilter}
        onClose={closeMentionMenu}
        onInsertUserName={insertMention}
        filteredChatMembers={mentionFilteredMembers}
        usersById={usersById}
      />
      <div id="message-compose">
        <ComposerEmbeddedMessage />
        {allowedAttachmentOptions.canAttachEmbedLinks && (
          <WebPagePreview chatId={chatId} messageText={!attachments.length ? html : ''} />
        )}
        <div className="message-input-wrapper">
          {IS_MOBILE_SCREEN ? (
            <Button
              className={symbolMenuButtonClassName}
              round
              color="translucent"
              onClick={isSymbolMenuOpen ? closeSymbolMenu : handleSymbolMenuOpen}
              ariaLabel="Choose emoji, sticker or GIF"
            >
              <i className="icon-smile" />
              <i className="icon-keyboard" />
              <Spinner color="gray" />
            </Button>
          ) : (
            <ResponsiveHoverButton
              className={`${isSymbolMenuOpen ? 'activated' : ''}`}
              round
              faded
              color="translucent"
              onActivate={openSymbolMenu}
              ariaLabel="Choose emoji, sticker or GIF"
            >
              <i className="icon-smile" />
            </ResponsiveHoverButton>
          )}
          <MessageInput
            id="message-input-text"
            html={!attachments.length ? html : ''}
            placeholder={
              activeVoiceRecording && window.innerWidth <= SCREEN_WIDTH_TO_HIDE_PLACEHOLDER ? '' : lang('Message')
            }
            shouldSetFocus={isSymbolMenuOpen}
            shouldSupressFocus={IS_MOBILE_SCREEN && isSymbolMenuOpen}
            onUpdate={setHtml}
            onSend={mainButtonState === MainButtonState.Edit
              ? handleEditComplete
              : (shouldSchedule ? openCalendar : handleSend)}
            onSupressedFocus={closeSymbolMenu}
          />
          {withScheduledButton && (
            <Button
              round
              faded
              className="scheduled-button"
              color="translucent"
              onClick={handleAllScheduledClick}
              ariaLabel="Open scheduled messages"
            >
              <i className="icon-schedule" />
            </Button>
          )}
          {botKeyboardMessageId && !activeVoiceRecording && !editingMessage && (
            <ResponsiveHoverButton
              className={`${isBotKeyboardOpen ? 'activated' : ''}`}
              round
              faded
              color="translucent"
              onActivate={openBotKeyboard}
              ariaLabel="Open bot command keyboard"
            >
              <i className="icon-bot-command" />
            </ResponsiveHoverButton>
          )}
          {!activeVoiceRecording && !editingMessage && (
            <ResponsiveHoverButton
              className={`${isAttachMenuOpen ? 'activated' : ''}`}
              round
              faded
              color="translucent"
              onActivate={openAttachMenu}
              ariaLabel="Add an attachment"
            >
              <i className="icon-attach" />
            </ResponsiveHoverButton>
          )}
          {activeVoiceRecording && currentRecordTime && (
            <span className="recording-state">
              {formatVoiceRecordDuration(currentRecordTime - startRecordTimeRef.current!)}
            </span>
          )}
          <EmojiTooltip
            isOpen={isEmojiTooltipOpen}
            onStickerSelect={handleStickerSelect}
          />
          <AttachMenu
            isOpen={isAttachMenuOpen}
            allowedAttachmentOptions={allowedAttachmentOptions}
            onFileSelect={handleFileSelect}
            onPollCreate={openPollModal}
            onClose={closeAttachMenu}
          />
          {botKeyboardMessageId && (
            <BotKeyboardMenu
              messageId={botKeyboardMessageId}
              isOpen={isBotKeyboardOpen}
              onClose={closeBotKeyboard}
            />
          )}
          <SymbolMenu
            isOpen={isSymbolMenuOpen}
            allowedAttachmentOptions={allowedAttachmentOptions}
            onLoad={onSymbolMenuLoadingComplete}
            onClose={closeSymbolMenu}
            onEmojiSelect={insertTextAndUpdateCursor}
            onStickerSelect={handleStickerSelect}
            onGifSelect={handleGifSelect}
            onRemoveSymbol={removeSymbol}
            onSearchOpen={handleSearchOpen}
          />
        </div>
      </div>
      {activeVoiceRecording && (
        <Button
          round
          color="danger"
          className="cancel"
          onClick={stopRecordingVoice}
          ariaLabel="Cancel voice recording"
        >
          <i className="icon-delete" />
        </Button>
      )}
      <Button
        ref={mainButtonRef}
        round
        color="secondary"
        className={`${mainButtonState} ${activeVoiceRecording ? 'recording' : ''}`}
        disabled={areVoiceMessagesNotAllowed}
        ariaLabel={sendButtonAriaLabel}
        onClick={mainButtonHandler}
        onContextMenu={
          mainButtonState === MainButtonState.Send && canShowCustomSendMenu ? handleContextMenu : undefined
        }
      >
        <i className="icon-send" />
        <i className="icon-microphone-alt" />
        <i className="icon-check" />
      </Button>
      {canShowCustomSendMenu && (
        <CustomSendMenu
          isOpen={isCustomSendMenuOpen}
          onSilentSend={!isChatWithSelf ? handleSilentSend : undefined}
          onScheduleSend={!shouldSchedule ? openCalendar : undefined}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        />
      )}
      <CalendarModal
        isOpen={isCalendarOpen}
        withTimePicker
        selectedAt={scheduledDefaultDate.getTime()}
        maxAt={getDayStartAt(scheduledMaxDate)}
        isFutureMode
        secondButtonLabel={canScheduleUntilOnline ? 'Send When Online' : undefined}
        onClose={handleCloseCalendar}
        onSubmit={handleMessageSchedule}
        onSecondButtonClick={canScheduleUntilOnline ? handleMessageScheduleUntilOnline : undefined}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId, messageListType }): StateProps => {
    const chat = selectChat(global, chatId);
    const chatUser = chat && selectChatUser(global, chat);
    const isChatWithBot = chat ? selectIsChatWithBot(global, chat) : undefined;
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const messageWithActualBotKeyboard = isChatWithBot && selectNewestMessageWithBotKeyboardButtons(global, chatId);
    const scheduledIds = selectScheduledIds(global, chatId);

    return {
      editingMessage: selectEditingMessage(global, chatId, threadId, messageListType),
      connectionState: global.connectionState,
      draft: selectDraft(global, chatId, threadId),
      chat,
      isChatWithBot,
      isChatWithSelf,
      canScheduleUntilOnline: (
        !isChatWithSelf && !isChatWithBot
        && (chat && chatUser && isChatPrivate(chatId) && chatUser.status && Boolean(chatUser.status.wasOnline))
      ),
      isRightColumnShown: selectIsRightColumnShown(global),
      isSelectModeActive: selectIsInSelectMode(global),
      withScheduledButton: (
        threadId === MAIN_THREAD_ID
        && messageListType === 'thread'
        && Boolean(scheduledIds && scheduledIds.length)
      ),
      shouldSchedule: messageListType === 'scheduled',
      botKeyboardMessageId: messageWithActualBotKeyboard ? messageWithActualBotKeyboard.id : undefined,
      isForwarding: chatId === global.forwardMessages.toChatId,
      canSuggestMembers: chat && isChatGroup(chat),
      isPollModalOpen: global.isPollModalOpen,
      stickersForEmoji: global.stickers.forEmoji.stickers,
      groupChatMembers: chat && chat.fullInfo && chat.fullInfo.members,
      currentUserId: global.currentUserId,
      usersById: global.users.byId,
      lastSyncTime: global.lastSyncTime,
      contentToBeScheduled: global.messages.contentToBeScheduled,
      isPaymentModalOpen: global.payment.isPaymentModalOpen,
      isReceiptModalOpen: Boolean(global.payment.receipt),
      shouldSuggestStickers: global.settings.byKey.shouldSuggestStickers,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'sendMessage',
    'editMessage',
    'saveDraft',
    'clearDraft',
    'showError',
    'setStickerSearchQuery',
    'setGifSearchQuery',
    'forwardMessages',
    'openPollModal',
    'closePollModal',
    'closePaymentModal',
    'clearReceipt',
    'loadScheduledHistory',
    'openChat',
  ]),
)(Composer));
