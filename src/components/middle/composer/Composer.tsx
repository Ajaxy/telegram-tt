import React, {
  FC, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getDispatch, getGlobal, withGlobal } from '../../../lib/teact/teactn';

import { GlobalState, MessageListType } from '../../../global/types';
import {
  ApiAttachment,
  ApiBotInlineResult,
  ApiBotInlineMediaResult,
  ApiSticker,
  ApiVideo,
  ApiNewPoll,
  ApiMessage,
  ApiFormattedText,
  ApiChat,
  ApiChatMember,
  ApiUser,
  MAIN_THREAD_ID,
  ApiBotCommand,
} from '../../../api/types';
import { InlineBotSettings } from '../../../types';

import {
  BASE_EMOJI_KEYWORD_LANG, EDITABLE_INPUT_ID, REPLIES_USER_ID, SCHEDULED_WHEN_ONLINE, SEND_MESSAGE_ACTION_INTERVAL,
} from '../../../config';
import { IS_VOICE_RECORDING_SUPPORTED, IS_SINGLE_COLUMN_LAYOUT, IS_IOS } from '../../../util/environment';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import {
  selectChat,
  selectIsRightColumnShown,
  selectIsInSelectMode,
  selectNewestMessageWithBotKeyboardButtons,
  selectDraft,
  selectScheduledIds,
  selectEditingMessage,
  selectIsChatWithSelf,
  selectChatBot,
  selectChatUser,
  selectChatMessage,
  selectUser,
  selectUserStatus,
} from '../../../modules/selectors';
import {
  getAllowedAttachmentOptions,
  getChatSlowModeOptions,
  isUserId,
  isChatAdmin,
  isChatSuperGroup,
  isChatChannel,
} from '../../../modules/helpers';
import { formatMediaDuration, formatVoiceRecordDuration, getDayStartAt } from '../../../util/dateFormat';
import focusEditableElement from '../../../util/focusEditableElement';
import parseMessageInput from '../../../util/parseMessageInput';
import buildAttachment from './helpers/buildAttachment';
import renderText from '../../common/helpers/renderText';
import insertHtmlInSelection from '../../../util/insertHtmlInSelection';
import deleteLastCharacterOutsideSelection from '../../../util/deleteLastCharacterOutsideSelection';
import buildClassName from '../../../util/buildClassName';
import windowSize from '../../../util/windowSize';
import { isSelectionInsideInput } from './helpers/selection';
import applyIosAutoCapitalizationFix from './helpers/applyIosAutoCapitalizationFix';
import { getServerTime } from '../../../util/serverTime';

import useFlag from '../../../hooks/useFlag';
import usePrevious from '../../../hooks/usePrevious';
import useStickerTooltip from './hooks/useStickerTooltip';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useLang from '../../../hooks/useLang';
import useSendMessageAction from '../../../hooks/useSendMessageAction';
import useInterval from '../../../hooks/useInterval';
import useOnChange from '../../../hooks/useOnChange';
import { useStateRef } from '../../../hooks/useStateRef';
import useVoiceRecording from './hooks/useVoiceRecording';
import useClipboardPaste from './hooks/useClipboardPaste';
import useDraft from './hooks/useDraft';
import useEditing from './hooks/useEditing';
import useEmojiTooltip from './hooks/useEmojiTooltip';
import useMentionTooltip from './hooks/useMentionTooltip';
import useInlineBotTooltip from './hooks/useInlineBotTooltip';
import useBotCommandTooltip from './hooks/useBotCommandTooltip';

import DeleteMessageModal from '../../common/DeleteMessageModal.async';
import Button from '../../ui/Button';
import ResponsiveHoverButton from '../../ui/ResponsiveHoverButton';
import Spinner from '../../ui/Spinner';
import CalendarModal from '../../common/CalendarModal.async';
import AttachMenu from './AttachMenu';
import Avatar from '../../common/Avatar';
import SymbolMenu from './SymbolMenu.async';
import InlineBotTooltip from './InlineBotTooltip.async';
import MentionTooltip from './MentionTooltip.async';
import CustomSendMenu from './CustomSendMenu.async';
import StickerTooltip from './StickerTooltip.async';
import EmojiTooltip from './EmojiTooltip.async';
import BotCommandTooltip from './BotCommandTooltip.async';
import BotKeyboardMenu from './BotKeyboardMenu';
import MessageInput from './MessageInput';
import ComposerEmbeddedMessage from './ComposerEmbeddedMessage';
import AttachmentModal from './AttachmentModal.async';
import BotCommandMenu from './BotCommandMenu.async';
import PollModal from './PollModal.async';
import DropArea, { DropAreaState } from './DropArea.async';
import WebPagePreview from './WebPagePreview';
import SendAsMenu from './SendAsMenu.async';

import './Composer.scss';

type OwnProps = {
  chatId: string;
  threadId: number;
  messageListType: MessageListType;
  dropAreaState: string;
  isReady: boolean;
  onDropHide: NoneToVoidFunction;
};

type StateProps =
  {
    editingMessage?: ApiMessage;
    chat?: ApiChat;
    draft?: ApiFormattedText;
    isChatWithBot?: boolean;
    isChatWithSelf?: boolean;
    isChannel?: boolean;
    isRightColumnShown?: boolean;
    isSelectModeActive?: boolean;
    isForwarding?: boolean;
    isPollModalOpen?: boolean;
    botKeyboardMessageId?: number;
    botKeyboardPlaceholder?: string;
    withScheduledButton?: boolean;
    shouldSchedule?: boolean;
    canScheduleUntilOnline?: boolean;
    stickersForEmoji?: ApiSticker[];
    groupChatMembers?: ApiChatMember[];
    currentUserId?: string;
    recentEmojis: string[];
    lastSyncTime?: number;
    contentToBeScheduled?: GlobalState['messages']['contentToBeScheduled'];
    shouldSuggestStickers?: boolean;
    baseEmojiKeywords?: Record<string, string[]>;
    emojiKeywords?: Record<string, string[]>;
    topInlineBotIds?: string[];
    isInlineBotLoading: boolean;
    inlineBots?: Record<string, false | InlineBotSettings>;
    botCommands?: ApiBotCommand[] | false;
    chatBotCommands?: ApiBotCommand[];
    sendAsUser?: ApiUser;
    sendAsChat?: ApiChat;
    sendAsId?: string;
  }
  & Pick<GlobalState, 'connectionState'>;

enum MainButtonState {
  Send = 'send',
  Record = 'record',
  Edit = 'edit',
  Schedule = 'schedule',
}

const VOICE_RECORDING_FILENAME = 'wonderful-voice-message.ogg';
// When voice recording is active, composer placeholder will hide to prevent overlapping
const SCREEN_WIDTH_TO_HIDE_PLACEHOLDER = 600; // px

const MOBILE_KEYBOARD_HIDE_DELAY_MS = 100;
const SELECT_MODE_TRANSITION_MS = 200;
const MESSAGE_MAX_LENGTH = 4096;
const CAPTION_MAX_LENGTH = 1024;
const SENDING_ANIMATION_DURATION = 350;
// eslint-disable-next-line max-len
const APPENDIX = '<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"/><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"/></filter></defs><g fill="none" fill-rule="evenodd"><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#000" filter="url(#a)"/><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#FFF" class="corner"/></g></svg>';

const Composer: FC<OwnProps & StateProps> = ({
  dropAreaState,
  shouldSchedule,
  canScheduleUntilOnline,
  isReady,
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
  isChannel,
  isRightColumnShown,
  isSelectModeActive,
  isForwarding,
  isPollModalOpen,
  botKeyboardMessageId,
  botKeyboardPlaceholder,
  withScheduledButton,
  stickersForEmoji,
  groupChatMembers,
  topInlineBotIds,
  currentUserId,
  lastSyncTime,
  contentToBeScheduled,
  shouldSuggestStickers,
  baseEmojiKeywords,
  emojiKeywords,
  recentEmojis,
  inlineBots,
  isInlineBotLoading,
  botCommands,
  chatBotCommands,
  sendAsUser,
  sendAsChat,
  sendAsId,
}) => {
  const {
    sendMessage,
    clearDraft,
    showDialog,
    setStickerSearchQuery,
    setGifSearchQuery,
    forwardMessages,
    openPollModal,
    closePollModal,
    loadScheduledHistory,
    openChat,
    addRecentEmoji,
    sendInlineBotResult,
    loadSendAs,
    loadFullChat,
  } = getDispatch();
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const appendixRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string>('');
  const htmlRef = useStateRef(html);
  const lastMessageSendTimeSeconds = useRef<number>();
  const prevDropAreaState = usePrevious(dropAreaState);
  const [isCalendarOpen, openCalendar, closeCalendar] = useFlag();
  const [
    scheduledMessageArgs, setScheduledMessageArgs,
  ] = useState<GlobalState['messages']['contentToBeScheduled'] | undefined>();
  const { width: windowWidth } = windowSize.get();
  const sendAsIds = chat?.sendAsIds;
  const canShowSendAs = sendAsIds && (sendAsIds.length > 1 || !sendAsIds.includes(currentUserId!));
  const sendMessageAction = useSendMessageAction(chatId, threadId);

  useEffect(() => {
    lastMessageSendTimeSeconds.current = undefined;
  }, [chatId]);

  useEffect(() => {
    if (chatId && lastSyncTime && threadId === MAIN_THREAD_ID && isReady) {
      loadScheduledHistory({ chatId });
    }
  }, [isReady, chatId, loadScheduledHistory, lastSyncTime, threadId]);

  useEffect(() => {
    if (chatId && chat && lastSyncTime && !sendAsIds && isReady && isChatSuperGroup(chat)) {
      loadSendAs({ chatId });
    }
  }, [chat, chatId, isReady, lastSyncTime, loadSendAs, sendAsIds]);

  useEffect(() => {
    if (chatId && chat && lastSyncTime && !chat.fullInfo && isReady && isChatSuperGroup(chat)) {
      loadFullChat({ chatId });
    }
  }, [chat, chatId, isReady, lastSyncTime, loadFullChat]);

  const shouldAnimateSendAsButtonRef = useRef(false);
  useOnChange(([prevChatId, prevSendAsIds]) => {
    // We only animate send-as button if `sendAsIds` was missing when opening the chat
    shouldAnimateSendAsButtonRef.current = Boolean(chatId === prevChatId && sendAsIds && !prevSendAsIds);
  }, [chatId, sendAsIds]);

  useLayoutEffect(() => {
    if (!appendixRef.current) return;

    appendixRef.current.innerHTML = APPENDIX;
  }, []);

  useEffect(() => {
    if (contentToBeScheduled) {
      setScheduledMessageArgs(contentToBeScheduled);
      openCalendar();
    }
  }, [contentToBeScheduled, openCalendar]);

  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);

  const [isBotKeyboardOpen, openBotKeyboard, closeBotKeyboard] = useFlag();
  const [isBotCommandMenuOpen, openBotCommandMenu, closeBotCommandMenu] = useFlag();
  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag();
  const [isSendAsMenuOpen, openSendAsMenu, closeSendAsMenu] = useFlag();
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

  useInterval(() => {
    sendMessageAction({ type: 'recordAudio' });
  }, activeVoiceRecording && SEND_MESSAGE_ACTION_INTERVAL);

  useEffect(() => {
    if (!activeVoiceRecording) {
      sendMessageAction({ type: 'cancel' });
    }
  }, [activeVoiceRecording, sendMessageAction]);

  const mainButtonState = editingMessage ? MainButtonState.Edit
    : (!IS_VOICE_RECORDING_SUPPORTED || activeVoiceRecording || (html && !attachments.length) || isForwarding)
      ? (shouldSchedule ? MainButtonState.Schedule : MainButtonState.Send)
      : MainButtonState.Record;
  const canShowCustomSendMenu = !shouldSchedule;

  const {
    isMentionTooltipOpen, closeMentionTooltip, insertMention, mentionFilteredUsers,
  } = useMentionTooltip(
    !attachments.length,
    htmlRef,
    setHtml,
    undefined,
    groupChatMembers,
    topInlineBotIds,
    currentUserId,
  );

  const {
    isOpen: isInlineBotTooltipOpen,
    id: inlineBotId,
    isGallery: isInlineBotTooltipGallery,
    switchPm: inlineBotSwitchPm,
    results: inlineBotResults,
    closeTooltip: closeInlineBotTooltip,
    help: inlineBotHelp,
    loadMore: loadMoreForInlineBot,
  } = useInlineBotTooltip(
    Boolean(!attachments.length && lastSyncTime),
    chatId,
    html,
    inlineBots,
  );

  const {
    isOpen: isBotCommandTooltipOpen,
    close: closeBotCommandTooltip,
    filteredBotCommands: botTooltipCommands,
  } = useBotCommandTooltip(
    Boolean((botCommands && botCommands.length) || (chatBotCommands && chatBotCommands.length)),
    html,
    botCommands,
    chatBotCommands,
  );

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !(mainButtonState === MainButtonState.Send && canShowCustomSendMenu));

  const {
    canSendStickers, canSendGifs, canAttachMedia, canAttachPolls, canAttachEmbedLinks,
  } = useMemo(() => getAllowedAttachmentOptions(chat, isChatWithBot), [chat, isChatWithBot]);

  const isAdmin = chat && isChatAdmin(chat);
  const slowMode = getChatSlowModeOptions(chat);

  const { isStickerTooltipOpen, closeStickerTooltip } = useStickerTooltip(
    Boolean(shouldSuggestStickers && canSendStickers && !attachments.length),
    html,
    stickersForEmoji,
    !isReady,
  );
  const {
    isEmojiTooltipOpen, closeEmojiTooltip, filteredEmojis, insertEmoji,
  } = useEmojiTooltip(
    Boolean(shouldSuggestStickers && canSendStickers && !attachments.length),
    htmlRef,
    recentEmojis,
    undefined,
    setHtml,
    baseEmojiKeywords,
    emojiKeywords,
    !isReady,
  );

  const insertTextAndUpdateCursor = useCallback((text: string, inputId: string = EDITABLE_INPUT_ID) => {
    const selection = window.getSelection()!;
    const messageInput = document.getElementById(inputId)!;
    const newHtml = renderText(text, ['escape_html', 'emoji_html', 'br_html'])
      .join('')
      .replace(/\u200b+/g, '\u200b');

    if (selection.rangeCount) {
      const selectionRange = selection.getRangeAt(0);
      if (isSelectionInsideInput(selectionRange, inputId)) {
        insertHtmlInSelection(newHtml);
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }

    setHtml(`${htmlRef.current!}${newHtml}`);

    // If selection is outside of input, set cursor at the end of input
    requestAnimationFrame(() => {
      focusEditableElement(messageInput);
    });
  }, [htmlRef]);

  const removeSymbol = useCallback(() => {
    const selection = window.getSelection()!;

    if (selection.rangeCount) {
      const selectionRange = selection.getRangeAt(0);
      if (isSelectionInsideInput(selectionRange, EDITABLE_INPUT_ID)) {
        document.execCommand('delete', false);
        return;
      }
    }

    setHtml(deleteLastCharacterOutsideSelection(htmlRef.current!));
  }, [htmlRef]);

  const resetComposer = useCallback((shouldPreserveInput = false) => {
    if (!shouldPreserveInput) {
      setHtml('');
    }
    setAttachments(MEMO_EMPTY_ARRAY);
    closeStickerTooltip();
    closeCalendar();
    setScheduledMessageArgs(undefined);
    closeMentionTooltip();
    closeEmojiTooltip();

    if (IS_SINGLE_COLUMN_LAYOUT) {
      // @optimization
      setTimeout(() => closeSymbolMenu(), SENDING_ANIMATION_DURATION);
    } else {
      closeSymbolMenu();
    }
  }, [closeStickerTooltip, closeCalendar, closeMentionTooltip, closeEmojiTooltip, closeSymbolMenu]);

  // Handle chat change (ref is used to avoid redundant effect calls)
  const stopRecordingVoiceRef = useRef<typeof stopRecordingVoice>();
  stopRecordingVoiceRef.current = stopRecordingVoice;
  useEffect(() => {
    return () => {
      stopRecordingVoiceRef.current!();
      resetComposer();
    };
  }, [chatId, resetComposer, stopRecordingVoiceRef]);

  const handleEditComplete = useEditing(htmlRef, setHtml, editingMessage, resetComposer, openDeleteModal);
  useDraft(draft, chatId, threadId, htmlRef, setHtml, editingMessage);
  useClipboardPaste(insertTextAndUpdateCursor, setAttachments, editingMessage);

  const handleFileSelect = useCallback(async (files: File[], isQuick: boolean) => {
    setAttachments(await Promise.all(files.map((file) => buildAttachment(file.name, file, isQuick))));
  }, []);

  const handleAppendFiles = useCallback(async (files: File[], isQuick: boolean) => {
    setAttachments([
      ...attachments,
      ...await Promise.all(files.map((file) => buildAttachment(file.name, file, isQuick))),
    ]);
  }, [attachments]);

  const handleClearAttachment = useCallback(() => {
    setAttachments(MEMO_EMPTY_ARRAY);
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

    // No need to subscribe on updates in `mapStateToProps`
    const { serverTimeOffset } = getGlobal();

    const maxLength = currentAttachments.length ? CAPTION_MAX_LENGTH : MESSAGE_MAX_LENGTH;
    if (text?.length > maxLength) {
      const extraLength = text.length - maxLength;
      showDialog({
        data: {
          message: 'MESSAGE_TOO_LONG_PLEASE_REMOVE_CHARACTERS',
          textParams: {
            '{EXTRA_CHARS_COUNT}': extraLength,
            '{PLURAL_S}': extraLength > 1 ? 's' : '',
          },
          hasErrorKey: true,
        },
      });

      return;
    }

    const messageInput = document.getElementById(EDITABLE_INPUT_ID)!;

    if (currentAttachments.length || text) {
      if (slowMode && !isAdmin) {
        const nowSeconds = getServerTime(serverTimeOffset);
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
          showDialog({
            data: {
              message: lang('SlowModeHint', formatMediaDuration(secondsRemaining)),
              isSlowMode: true,
              hasErrorKey: false,
            },
          });

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
      forwardMessages({
        scheduledAt,
        isSilent,
      });
    }

    lastMessageSendTimeSeconds.current = getServerTime(serverTimeOffset);

    clearDraft({ chatId, localOnly: true });

    if (IS_IOS && messageInput === document.activeElement) {
      applyIosAutoCapitalizationFix(messageInput);
    }

    // Wait until message animation starts
    requestAnimationFrame(() => {
      resetComposer();
    });
  }, [
    connectionState, attachments, activeVoiceRecording, isForwarding, clearDraft, chatId,
    resetComposer, stopRecordingVoice, showDialog, slowMode, isAdmin, sendMessage, forwardMessages, lang, htmlRef,
  ]);

  const handleActivateBotCommandMenu = useCallback(() => {
    closeSymbolMenu();
    openBotCommandMenu();
  }, [closeSymbolMenu, openBotCommandMenu]);

  const handleActivateSymbolMenu = useCallback(() => {
    closeBotCommandMenu();
    closeSendAsMenu();
    openSymbolMenu();
  }, [closeBotCommandMenu, closeSendAsMenu, openSymbolMenu]);

  const handleStickerSelect = useCallback((sticker: ApiSticker, shouldPreserveInput = false) => {
    sticker = {
      ...sticker,
      isPreloadedGlobally: true,
    };

    if (shouldSchedule) {
      setScheduledMessageArgs({ sticker });
      openCalendar();
    } else {
      sendMessage({ sticker });
      requestAnimationFrame(() => {
        resetComposer(shouldPreserveInput);
      });
    }
  }, [shouldSchedule, openCalendar, sendMessage, resetComposer]);

  const handleGifSelect = useCallback((gif: ApiVideo) => {
    if (shouldSchedule) {
      setScheduledMessageArgs({ gif });
      openCalendar();
    } else {
      sendMessage({ gif });
      requestAnimationFrame(() => {
        resetComposer(true);
      });
    }
  }, [shouldSchedule, openCalendar, sendMessage, resetComposer]);

  const handleInlineBotSelect = useCallback((inlineResult: ApiBotInlineResult | ApiBotInlineMediaResult) => {
    if (connectionState !== 'connectionStateReady') {
      return;
    }

    sendInlineBotResult({
      id: inlineResult.id,
      queryId: inlineResult.queryId,
    });

    const messageInput = document.getElementById(EDITABLE_INPUT_ID)!;
    if (IS_IOS && messageInput === document.activeElement) {
      applyIosAutoCapitalizationFix(messageInput);
    }

    clearDraft({ chatId, localOnly: true });
    requestAnimationFrame(() => {
      resetComposer();
    });
  }, [chatId, clearDraft, connectionState, resetComposer, sendInlineBotResult]);

  const handleBotCommandSelect = useCallback(() => {
    clearDraft({ chatId, localOnly: true });
    requestAnimationFrame(() => {
      resetComposer();
    });
  }, [chatId, clearDraft, resetComposer]);

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
      void handleSend(true);
    }
  }, [handleSend, openCalendar, shouldSchedule]);

  const handleMessageSchedule = useCallback((date: Date, isWhenOnline = false) => {
    const { isSilent, ...restArgs } = scheduledMessageArgs || {};

    // No need to subscribe on updates in `mapStateToProps`
    const { serverTimeOffset } = getGlobal();

    // Scheduled time can not be less than 10 seconds in future
    const scheduledAt = Math.round(Math.max(date.getTime(), Date.now() + 60 * 1000) / 1000)
      + (isWhenOnline ? 0 : serverTimeOffset);

    if (!scheduledMessageArgs || Object.keys(restArgs).length === 0) {
      void handleSend(Boolean(isSilent), scheduledAt);
    } else {
      sendMessage({
        ...scheduledMessageArgs,
        scheduledAt,
      });
      requestAnimationFrame(() => {
        resetComposer();
      });
    }
    closeCalendar();
  }, [closeCalendar, handleSend, resetComposer, scheduledMessageArgs, sendMessage]);

  const handleMessageScheduleUntilOnline = useCallback(() => {
    handleMessageSchedule(new Date(SCHEDULED_WHEN_ONLINE * 1000), true);
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

    if (!IS_SINGLE_COLUMN_LAYOUT || messageInput !== document.activeElement) {
      openSymbolMenu();
      return;
    }

    messageInput.blur();
    setTimeout(() => {
      closeBotCommandMenu();
      openSymbolMenu();
    }, MOBILE_KEYBOARD_HIDE_DELAY_MS);
  }, [openSymbolMenu, closeBotCommandMenu]);

  const handleSendAsMenuOpen = useCallback(() => {
    const messageInput = document.getElementById(EDITABLE_INPUT_ID)!;

    if (!IS_SINGLE_COLUMN_LAYOUT || messageInput !== document.activeElement) {
      closeBotCommandMenu();
      closeSymbolMenu();
      openSendAsMenu();
      return;
    }

    messageInput.blur();
    setTimeout(() => {
      closeBotCommandMenu();
      closeSymbolMenu();
      openSendAsMenu();
    }, MOBILE_KEYBOARD_HIDE_DELAY_MS);
  }, [closeBotCommandMenu, closeSymbolMenu, openSendAsMenu]);

  const handleAllScheduledClick = useCallback(() => {
    openChat({ id: chatId, threadId, type: 'scheduled' });
  }, [openChat, chatId, threadId]);

  useEffect(() => {
    if (isRightColumnShown && IS_SINGLE_COLUMN_LAYOUT) {
      closeSymbolMenu();
    }
  }, [isRightColumnShown, closeSymbolMenu]);

  useEffect(() => {
    if (!isReady) return;

    if (isSelectModeActive) {
      disableHover();
    } else {
      setTimeout(() => {
        enableHover();
      }, SELECT_MODE_TRANSITION_MS);
    }
  }, [isSelectModeActive, enableHover, disableHover, isReady]);

  const mainButtonHandler = useCallback(() => {
    switch (mainButtonState) {
      case MainButtonState.Send:
        handleSend();
        break;
      case MainButtonState.Record:
        void startRecordingVoice();
        break;
      case MainButtonState.Edit:
        handleEditComplete();
        break;
      case MainButtonState.Schedule:
        if (activeVoiceRecording) {
          pauseRecordingVoice();
        }
        openCalendar();
        break;
      default:
        break;
    }
  }, [
    mainButtonState, handleSend, startRecordingVoice, handleEditComplete,
    activeVoiceRecording, openCalendar, pauseRecordingVoice,
  ]);

  const areVoiceMessagesNotAllowed = mainButtonState === MainButtonState.Record && !canAttachMedia;

  const prevEditedMessage = usePrevious(editingMessage, true);
  const renderedEditedMessage = editingMessage || prevEditedMessage;

  const scheduledDefaultDate = new Date();
  scheduledDefaultDate.setSeconds(0);
  scheduledDefaultDate.setMilliseconds(0);

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  let sendButtonAriaLabel = 'SendMessage';
  switch (mainButtonState) {
    case MainButtonState.Edit:
      sendButtonAriaLabel = 'Save edited message';
      break;
    case MainButtonState.Record:
      sendButtonAriaLabel = areVoiceMessagesNotAllowed
        ? 'Conversation.DefaultRestrictedMedia'
        : 'AccDescrVoiceMessage';
  }

  const className = buildClassName(
    'Composer',
    !isSelectModeActive && 'shown',
    isHoverDisabled && 'hover-disabled',
  );

  const symbolMenuButtonClassName = buildClassName(
    'mobile-symbol-menu-button',
    !isReady && 'not-ready',
    isSymbolMenuLoaded
      ? (isSymbolMenuOpen && 'menu-opened')
      : (isSymbolMenuOpen && 'is-loading'),
  );

  const onSend = mainButtonState === MainButtonState.Edit
    ? handleEditComplete
    : mainButtonState === MainButtonState.Schedule ? openCalendar
      : handleSend;

  return (
    <div className={className}>
      {canAttachMedia && isReady && (
        <DropArea
          isOpen={dropAreaState !== DropAreaState.None}
          withQuick={dropAreaState === DropAreaState.QuickFile || prevDropAreaState === DropAreaState.QuickFile}
          onHide={onDropHide}
          onFileSelect={handleFileSelect}
        />
      )}
      <AttachmentModal
        chatId={chatId}
        threadId={threadId}
        canShowCustomSendMenu={canShowCustomSendMenu}
        attachments={attachments}
        caption={attachments.length ? html : ''}
        groupChatMembers={groupChatMembers}
        currentUserId={currentUserId}
        recentEmojis={recentEmojis}
        isReady={isReady}
        isChatWithSelf={isChatWithSelf}
        onCaptionUpdate={setHtml}
        baseEmojiKeywords={baseEmojiKeywords}
        emojiKeywords={emojiKeywords}
        addRecentEmoji={addRecentEmoji}
        onSilentSend={handleSilentSend}
        openCalendar={openCalendar}
        onSend={shouldSchedule ? openCalendar : handleSend}
        onFileAppend={handleAppendFiles}
        onClear={handleClearAttachment}
      />
      <PollModal
        isOpen={Boolean(isPollModalOpen)}
        shouldBeAnonimous={isChannel}
        onClear={closePollModal}
        onSend={handlePollSend}
      />
      {renderedEditedMessage && (
        <DeleteMessageModal
          isOpen={isDeleteModalOpen}
          isSchedule={messageListType === 'scheduled'}
          onClose={closeDeleteModal}
          message={renderedEditedMessage}
        />
      )}
      <SendAsMenu
        isOpen={isSendAsMenuOpen}
        onClose={closeSendAsMenu}
        chatId={chatId}
        selectedSendAsId={sendAsId}
        sendAsIds={sendAsIds}
      />
      <MentionTooltip
        isOpen={isMentionTooltipOpen}
        onClose={closeMentionTooltip}
        onInsertUserName={insertMention}
        filteredUsers={mentionFilteredUsers}
      />
      <InlineBotTooltip
        isOpen={isInlineBotTooltipOpen}
        botId={inlineBotId}
        isGallery={isInlineBotTooltipGallery}
        inlineBotResults={inlineBotResults}
        switchPm={inlineBotSwitchPm}
        onSelectResult={handleInlineBotSelect}
        loadMore={loadMoreForInlineBot}
        onClose={closeInlineBotTooltip}
      />
      <BotCommandTooltip
        isOpen={isBotCommandTooltipOpen}
        withUsername={Boolean(chatBotCommands)}
        botCommands={botTooltipCommands}
        onClick={handleBotCommandSelect}
        onClose={closeBotCommandTooltip}
      />
      <div id="message-compose">
        <div className="svg-appendix" ref={appendixRef} />
        <ComposerEmbeddedMessage />
        <WebPagePreview
          chatId={chatId}
          threadId={threadId}
          messageText={!attachments.length ? html : ''}
          disabled={!canAttachEmbedLinks}
        />
        <div className="message-input-wrapper">
          {isChatWithBot && botCommands !== false && !activeVoiceRecording && !editingMessage && (
            <ResponsiveHoverButton
              className={buildClassName('bot-commands', isBotCommandMenuOpen && 'activated')}
              round
              disabled={botCommands === undefined}
              color="translucent"
              onActivate={handleActivateBotCommandMenu}
              ariaLabel="Open bot command keyboard"
            >
              <i className="icon-bot-commands-filled" />
            </ResponsiveHoverButton>
          )}
          {canShowSendAs && (sendAsUser || sendAsChat) && (
            <Button
              round
              color="translucent"
              onClick={isSendAsMenuOpen ? closeSendAsMenu : handleSendAsMenuOpen}
              ariaLabel={lang('SendMessageAsTitle')}
              className={buildClassName('send-as-button', shouldAnimateSendAsButtonRef.current && 'appear-animation')}
            >
              <Avatar
                user={sendAsUser}
                chat={sendAsChat}
                size="tiny"
              />
            </Button>
          )}
          {IS_SINGLE_COLUMN_LAYOUT ? (
            <Button
              className={symbolMenuButtonClassName}
              round
              color="translucent"
              onClick={isSymbolMenuOpen ? closeSymbolMenu : handleSymbolMenuOpen}
              ariaLabel="Choose emoji, sticker or GIF"
            >
              <i className="icon-smile" />
              <i className="icon-keyboard" />
              {isSymbolMenuOpen && !isSymbolMenuLoaded && <Spinner color="gray" />}
            </Button>
          ) : (
            <ResponsiveHoverButton
              className={isSymbolMenuOpen ? 'activated' : ''}
              round
              color="translucent"
              onActivate={handleActivateSymbolMenu}
              ariaLabel="Choose emoji, sticker or GIF"
            >
              <i className="icon-smile" />
            </ResponsiveHoverButton>
          )}
          <MessageInput
            id="message-input-text"
            chatId={chatId}
            threadId={threadId}
            html={!attachments.length ? html : ''}
            placeholder={
              activeVoiceRecording && windowWidth <= SCREEN_WIDTH_TO_HIDE_PLACEHOLDER
                ? ''
                : botKeyboardPlaceholder || lang('Message')
            }
            forcedPlaceholder={inlineBotHelp}
            canAutoFocus={isReady && !attachments.length}
            shouldSuppressFocus={IS_SINGLE_COLUMN_LAYOUT && isSymbolMenuOpen}
            shouldSuppressTextFormatter={isEmojiTooltipOpen || isMentionTooltipOpen || isInlineBotTooltipOpen}
            onUpdate={setHtml}
            onSend={onSend}
            onSuppressedFocus={closeSymbolMenu}
          />
          {isInlineBotLoading && Boolean(inlineBotId) && (
            <Spinner color="gray" />
          )}
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
              className={isBotKeyboardOpen ? 'activated' : ''}
              round
              color="translucent"
              onActivate={openBotKeyboard}
              ariaLabel="Open bot command keyboard"
            >
              <i className="icon-bot-command" />
            </ResponsiveHoverButton>
          )}
          {activeVoiceRecording && currentRecordTime && (
            <span className="recording-state">
              {formatVoiceRecordDuration(currentRecordTime - startRecordTimeRef.current!)}
            </span>
          )}
          <StickerTooltip
            chatId={chatId}
            threadId={threadId}
            isOpen={isStickerTooltipOpen}
            onStickerSelect={handleStickerSelect}
          />
          <EmojiTooltip
            isOpen={isEmojiTooltipOpen}
            emojis={filteredEmojis}
            onClose={closeEmojiTooltip}
            onEmojiSelect={insertEmoji}
            addRecentEmoji={addRecentEmoji}
          />
          <AttachMenu
            isButtonVisible={!activeVoiceRecording && !editingMessage}
            canAttachMedia={canAttachMedia}
            canAttachPolls={canAttachPolls}
            onFileSelect={handleFileSelect}
            onPollCreate={openPollModal}
          />
          {botKeyboardMessageId && (
            <BotKeyboardMenu
              messageId={botKeyboardMessageId}
              isOpen={isBotKeyboardOpen}
              onClose={closeBotKeyboard}
            />
          )}
          {botCommands && (
            <BotCommandMenu
              isOpen={isBotCommandMenuOpen}
              botCommands={botCommands}
              onClose={closeBotCommandMenu}
            />
          )}
          <SymbolMenu
            chatId={chatId}
            threadId={threadId}
            isOpen={isSymbolMenuOpen}
            canSendGifs={canSendGifs}
            canSendStickers={canSendStickers}
            onLoad={onSymbolMenuLoadingComplete}
            onClose={closeSymbolMenu}
            onEmojiSelect={insertTextAndUpdateCursor}
            onStickerSelect={handleStickerSelect}
            onGifSelect={handleGifSelect}
            onRemoveSymbol={removeSymbol}
            onSearchOpen={handleSearchOpen}
            addRecentEmoji={addRecentEmoji}
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
        className={buildClassName(mainButtonState, !isReady && 'not-ready', activeVoiceRecording && 'recording')}
        disabled={areVoiceMessagesNotAllowed}
        ariaLabel={lang(sendButtonAriaLabel)}
        onClick={mainButtonHandler}
        onContextMenu={
          mainButtonState === MainButtonState.Send && canShowCustomSendMenu ? handleContextMenu : undefined
        }
      >
        <i className="icon-send" />
        <i className="icon-schedule" />
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
        secondButtonLabel={canScheduleUntilOnline ? lang('Schedule.SendWhenOnline') : undefined}
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
    const chatBot = chatId !== REPLIES_USER_ID ? selectChatBot(global, chatId) : undefined;
    const isChatWithBot = Boolean(chatBot);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const messageWithActualBotKeyboard = isChatWithBot && selectNewestMessageWithBotKeyboardButtons(global, chatId);
    const scheduledIds = selectScheduledIds(global, chatId);
    const { language, shouldSuggestStickers } = global.settings.byKey;
    const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
    const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;
    const botKeyboardMessageId = messageWithActualBotKeyboard ? messageWithActualBotKeyboard.id : undefined;
    const keyboardMessage = botKeyboardMessageId ? selectChatMessage(global, chatId, botKeyboardMessageId) : undefined;
    const { currentUserId } = global;
    const defaultSendAsId = chat?.fullInfo ? chat?.fullInfo?.sendAsId || currentUserId : undefined;
    const sendAsId = chat?.sendAsIds && defaultSendAsId && chat.sendAsIds.includes(defaultSendAsId)
      ? defaultSendAsId
      : (chat?.adminRights?.anonymous ? chat?.id : undefined);
    const sendAsUser = sendAsId ? selectUser(global, sendAsId) : undefined;
    const sendAsChat = !sendAsUser && sendAsId ? selectChat(global, sendAsId) : undefined;

    return {
      editingMessage: selectEditingMessage(global, chatId, threadId, messageListType),
      connectionState: global.connectionState,
      draft: selectDraft(global, chatId, threadId),
      chat,
      isChatWithBot,
      isChatWithSelf,
      isChannel: chat ? isChatChannel(chat) : undefined,
      canScheduleUntilOnline: Boolean(
        !isChatWithSelf && !isChatWithBot && chat && chatUser
        && isUserId(chatId) && selectUserStatus(global, chatId)?.wasOnline,
      ),
      isRightColumnShown: selectIsRightColumnShown(global),
      isSelectModeActive: selectIsInSelectMode(global),
      withScheduledButton: (
        threadId === MAIN_THREAD_ID
        && messageListType === 'thread'
        && Boolean(scheduledIds?.length)
      ),
      shouldSchedule: messageListType === 'scheduled',
      botKeyboardMessageId,
      botKeyboardPlaceholder: keyboardMessage?.keyboardPlaceholder,
      isForwarding: chatId === global.forwardMessages.toChatId,
      isPollModalOpen: global.isPollModalOpen,
      stickersForEmoji: global.stickers.forEmoji.stickers,
      groupChatMembers: chat?.fullInfo?.members,
      topInlineBotIds: global.topInlineBots?.userIds,
      currentUserId,
      lastSyncTime: global.lastSyncTime,
      contentToBeScheduled: global.messages.contentToBeScheduled,
      shouldSuggestStickers,
      recentEmojis: global.recentEmojis,
      baseEmojiKeywords: baseEmojiKeywords?.keywords,
      emojiKeywords: emojiKeywords?.keywords,
      inlineBots: global.inlineBots.byUsername,
      isInlineBotLoading: global.inlineBots.isLoading,
      chatBotCommands: chat && chat.fullInfo && chat.fullInfo.botCommands,
      botCommands: chatBot && chatBot.fullInfo ? (chatBot.fullInfo.botCommands || false) : undefined,
      sendAsUser,
      sendAsChat,
      sendAsId,
    };
  },
)(Composer));
