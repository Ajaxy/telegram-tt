import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { TabState, MessageListType, GlobalState } from '../../../global/types';
import type {
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
  ApiBotCommand,
  ApiBotMenuButton,
  ApiAttachMenuPeerType,
} from '../../../api/types';
import type { InlineBotSettings, ISettings } from '../../../types';

import {
  BASE_EMOJI_KEYWORD_LANG,
  EDITABLE_INPUT_ID,
  REPLIES_USER_ID,
  SEND_MESSAGE_ACTION_INTERVAL,
  EDITABLE_INPUT_CSS_SELECTOR,
  MAX_UPLOAD_FILEPART_SIZE, EDITABLE_INPUT_MODAL_ID,
} from '../../../config';
import { IS_VOICE_RECORDING_SUPPORTED, IS_IOS } from '../../../util/environment';
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
  selectChatMessage,
  selectUser,
  selectCanScheduleUntilOnline,
  selectEditingScheduledDraft,
  selectEditingDraft,
  selectRequestedDraftText,
  selectTheme,
  selectCurrentMessageList,
  selectIsCurrentUserPremium,
  selectChatType,
  selectRequestedDraftFiles,
  selectTabState,
  selectReplyingToId,
} from '../../../global/selectors';
import {
  getAllowedAttachmentOptions,
  getChatSlowModeOptions,
  isChatAdmin,
  isChatSuperGroup,
  isChatChannel,
  isUserId,
} from '../../../global/helpers';
import { formatMediaDuration, formatVoiceRecordDuration } from '../../../util/dateFormat';
import focusEditableElement from '../../../util/focusEditableElement';
import parseMessageInput from '../../../util/parseMessageInput';
import buildAttachment, { prepareAttachmentsToSend } from './helpers/buildAttachment';
import renderText from '../../common/helpers/renderText';
import { insertHtmlInSelection } from '../../../util/selection';
import deleteLastCharacterOutsideSelection from '../../../util/deleteLastCharacterOutsideSelection';
import buildClassName from '../../../util/buildClassName';
import windowSize from '../../../util/windowSize';
import { isSelectionInsideInput } from './helpers/selection';
import applyIosAutoCapitalizationFix from './helpers/applyIosAutoCapitalizationFix';
import { getServerTime } from '../../../util/serverTime';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import { buildCustomEmojiHtml } from './helpers/customEmoji';
import { processMessageInputForCustomEmoji } from '../../../util/customEmojiManager';
import { getTextWithEntitiesAsHtml } from '../../common/helpers/renderTextWithEntities';

import useSignal from '../../../hooks/useSignal';
import useFlag from '../../../hooks/useFlag';
import usePrevious from '../../../hooks/usePrevious';
import useStickerTooltip from './hooks/useStickerTooltip';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useLang from '../../../hooks/useLang';
import useSendMessageAction from '../../../hooks/useSendMessageAction';
import useInterval from '../../../hooks/useInterval';
import useSyncEffect from '../../../hooks/useSyncEffect';
import useVoiceRecording from './hooks/useVoiceRecording';
import useClipboardPaste from './hooks/useClipboardPaste';
import useEditing from './hooks/useEditing';
import useEmojiTooltip from './hooks/useEmojiTooltip';
import useMentionTooltip from './hooks/useMentionTooltip';
import useInlineBotTooltip from './hooks/useInlineBotTooltip';
import useBotCommandTooltip from './hooks/useBotCommandTooltip';
import useSchedule from '../../../hooks/useSchedule';
import useCustomEmojiTooltip from './hooks/useCustomEmojiTooltip';
import useAttachmentModal from './hooks/useAttachmentModal';
import useGetSelectionRange from '../../../hooks/useGetSelectionRange';
import useDerivedState from '../../../hooks/useDerivedState';
import { useStateRef } from '../../../hooks/useStateRef';
import useDraft from './hooks/useDraft';

import DeleteMessageModal from '../../common/DeleteMessageModal.async';
import Button from '../../ui/Button';
import ResponsiveHoverButton from '../../ui/ResponsiveHoverButton';
import Spinner from '../../ui/Spinner';
import AttachMenu from './AttachMenu';
import Avatar from '../../common/Avatar';
import InlineBotTooltip from './InlineBotTooltip.async';
import MentionTooltip from './MentionTooltip.async';
import CustomSendMenu from './CustomSendMenu.async';
import StickerTooltip from './StickerTooltip.async';
import CustomEmojiTooltip from './CustomEmojiTooltip.async';
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
import BotMenuButton from './BotMenuButton';
import SymbolMenuButton from './SymbolMenuButton';

import './Composer.scss';

type OwnProps = {
  chatId: string;
  threadId: number;
  messageListType: MessageListType;
  dropAreaState: string;
  isReady: boolean;
  isMobile?: boolean;
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
    replyingToId?: number;
    isForCurrentMessageList: boolean;
    isRightColumnShown?: boolean;
    isSelectModeActive?: boolean;
    isForwarding?: boolean;
    pollModal: TabState['pollModal'];
    botKeyboardMessageId?: number;
    botKeyboardPlaceholder?: string;
    withScheduledButton?: boolean;
    shouldSchedule?: boolean;
    canScheduleUntilOnline?: boolean;
    stickersForEmoji?: ApiSticker[];
    customEmojiForEmoji?: ApiSticker[];
    groupChatMembers?: ApiChatMember[];
    currentUserId?: string;
    recentEmojis: string[];
    lastSyncTime?: number;
    contentToBeScheduled?: TabState['contentToBeScheduled'];
    shouldSuggestStickers?: boolean;
    shouldSuggestCustomEmoji?: boolean;
    baseEmojiKeywords?: Record<string, string[]>;
    emojiKeywords?: Record<string, string[]>;
    topInlineBotIds?: string[];
    isInlineBotLoading: boolean;
    inlineBots?: Record<string, false | InlineBotSettings>;
    botCommands?: ApiBotCommand[] | false;
    botMenuButton?: ApiBotMenuButton;
    chatBotCommands?: ApiBotCommand[];
    sendAsUser?: ApiUser;
    sendAsChat?: ApiChat;
    sendAsId?: string;
    editingDraft?: ApiFormattedText;
    requestedDraftText?: string;
    requestedDraftFiles?: File[];
    attachBots: GlobalState['attachMenu']['bots'];
    attachMenuPeerType?: ApiAttachMenuPeerType;
    theme: ISettings['theme'];
    fileSizeLimit: number;
    captionLimit: number;
    isCurrentUserPremium?: boolean;
    canSendVoiceByPrivacy?: boolean;
    attachmentSettings: GlobalState['attachmentSettings'];
  }
  & Pick<GlobalState, 'connectionState'>;

enum MainButtonState {
  Send = 'send',
  Record = 'record',
  Edit = 'edit',
  Schedule = 'schedule',
}

type ScheduledMessageArgs = TabState['contentToBeScheduled'] | {
  id: string; queryId: string; isSilent?: boolean;
};

const VOICE_RECORDING_FILENAME = 'wonderful-voice-message.ogg';
// When voice recording is active, composer placeholder will hide to prevent overlapping
const SCREEN_WIDTH_TO_HIDE_PLACEHOLDER = 600; // px

const MOBILE_KEYBOARD_HIDE_DELAY_MS = 100;
const SELECT_MODE_TRANSITION_MS = 200;
const MESSAGE_MAX_LENGTH = 4096;
const SENDING_ANIMATION_DURATION = 350;
// eslint-disable-next-line max-len
const APPENDIX = '<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"/><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"/></filter></defs><g fill="none" fill-rule="evenodd"><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#000" filter="url(#a)"/><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#FFF" class="corner"/></g></svg>';

const Composer: FC<OwnProps & StateProps> = ({
  dropAreaState,
  shouldSchedule,
  canScheduleUntilOnline,
  isReady,
  isMobile,
  onDropHide,
  editingMessage,
  chatId,
  threadId,
  messageListType,
  draft,
  chat,
  isForCurrentMessageList,
  isCurrentUserPremium,
  canSendVoiceByPrivacy,
  connectionState,
  isChatWithBot,
  isChatWithSelf,
  isChannel,
  fileSizeLimit,
  isRightColumnShown,
  isSelectModeActive,
  isForwarding,
  pollModal,
  botKeyboardMessageId,
  botKeyboardPlaceholder,
  withScheduledButton,
  stickersForEmoji,
  customEmojiForEmoji,
  groupChatMembers,
  topInlineBotIds,
  currentUserId,
  captionLimit,
  lastSyncTime,
  contentToBeScheduled,
  shouldSuggestStickers,
  shouldSuggestCustomEmoji,
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
  editingDraft,
  replyingToId,
  requestedDraftText,
  requestedDraftFiles,
  botMenuButton,
  attachBots,
  attachMenuPeerType,
  attachmentSettings,
  theme,
}) => {
  const {
    sendMessage,
    clearDraft,
    showDialog,
    forwardMessages,
    openPollModal,
    closePollModal,
    loadScheduledHistory,
    openChat,
    addRecentEmoji,
    sendInlineBotResult,
    loadSendAs,
    resetOpenChatWithDraft,
    callAttachBot,
    addRecentCustomEmoji,
    showNotification,
  } = getActions();

  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const appendixRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLDivElement>(null);

  const [getHtml, setHtml] = useSignal('');
  const getSelectionRange = useGetSelectionRange(EDITABLE_INPUT_CSS_SELECTOR);
  const lastMessageSendTimeSeconds = useRef<number>();
  const prevDropAreaState = usePrevious(dropAreaState);
  const { width: windowWidth } = windowSize.get();
  const sendAsPeerIds = chat?.sendAsPeerIds;
  const canShowSendAs = sendAsPeerIds
    && (sendAsPeerIds.length > 1 || !sendAsPeerIds.some((peer) => peer.id === currentUserId!));
  // Prevent Symbol Menu from closing when calendar is open
  const [isSymbolMenuForced, forceShowSymbolMenu, cancelForceShowSymbolMenu] = useFlag();
  const sendMessageAction = useSendMessageAction(chatId, threadId);

  useEffect(processMessageInputForCustomEmoji, [getHtml]);

  const customEmojiNotificationNumber = useRef(0);

  const handleScheduleCancel = useCallback(() => {
    cancelForceShowSymbolMenu();
  }, [cancelForceShowSymbolMenu]);
  const [requestCalendar, calendar] = useSchedule(canScheduleUntilOnline, handleScheduleCancel);

  useEffect(() => {
    lastMessageSendTimeSeconds.current = undefined;
  }, [chatId]);

  useEffect(() => {
    if (chatId && lastSyncTime && isReady) {
      loadScheduledHistory({ chatId });
    }
  }, [isReady, chatId, loadScheduledHistory, lastSyncTime, threadId]);

  useEffect(() => {
    if (chatId && chat && lastSyncTime && !sendAsPeerIds && isReady && isChatSuperGroup(chat)) {
      loadSendAs({ chatId });
    }
  }, [chat, chatId, isReady, lastSyncTime, loadSendAs, sendAsPeerIds]);

  const shouldAnimateSendAsButtonRef = useRef(false);
  useSyncEffect(([prevChatId, prevSendAsPeerIds]) => {
    // We only animate send-as button if `sendAsPeerIds` was missing when opening the chat
    shouldAnimateSendAsButtonRef.current = Boolean(chatId === prevChatId && sendAsPeerIds && !prevSendAsPeerIds);
  }, [chatId, sendAsPeerIds]);

  useLayoutEffect(() => {
    if (!appendixRef.current) return;

    appendixRef.current.innerHTML = APPENDIX;
  }, []);

  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);
  const hasAttachments = Boolean(attachments.length);

  const {
    shouldSuggestCompression,
    handleAppendFiles,
    handleFileSelect,
    onCaptionUpdate,
    handleClearAttachments,
    handleSetAttachments,
  } = useAttachmentModal({
    attachments,
    setHtml,
    setAttachments,
    fileSizeLimit,
  });

  const [isBotKeyboardOpen, openBotKeyboard, closeBotKeyboard] = useFlag();
  const [isBotCommandMenuOpen, openBotCommandMenu, closeBotCommandMenu] = useFlag();
  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag();
  const [isSendAsMenuOpen, openSendAsMenu, closeSendAsMenu] = useFlag();
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
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

  const isEditingRef = useStateRef(Boolean(editingMessage));
  useEffect(() => {
    if (getHtml() && !isEditingRef.current) {
      sendMessageAction({ type: 'typing' });
    }
  }, [getHtml, isEditingRef, sendMessageAction]);

  const {
    canSendStickers, canSendGifs, canAttachMedia, canAttachPolls, canAttachEmbedLinks,
  } = useMemo(() => getAllowedAttachmentOptions(chat, isChatWithBot), [chat, isChatWithBot]);

  const isAdmin = chat && isChatAdmin(chat);
  const slowMode = getChatSlowModeOptions(chat);

  const {
    isEmojiTooltipOpen,
    closeEmojiTooltip,
    filteredEmojis,
    filteredCustomEmojis,
    insertEmoji,
  } = useEmojiTooltip(
    Boolean(isReady && isForCurrentMessageList && shouldSuggestStickers && !hasAttachments),
    getHtml,
    setHtml,
    undefined,
    recentEmojis,
    baseEmojiKeywords,
    emojiKeywords,
  );

  const {
    isCustomEmojiTooltipOpen,
    closeCustomEmojiTooltip,
    insertCustomEmoji,
  } = useCustomEmojiTooltip(
    Boolean(isReady && isForCurrentMessageList && shouldSuggestCustomEmoji && !hasAttachments),
    getHtml,
    setHtml,
    getSelectionRange,
    inputRef,
    customEmojiForEmoji,
  );

  const {
    isStickerTooltipOpen,
    closeStickerTooltip,
  } = useStickerTooltip(
    Boolean(isReady && isForCurrentMessageList && shouldSuggestStickers && canSendStickers && !hasAttachments),
    getHtml,
    stickersForEmoji,
  );

  const {
    isMentionTooltipOpen,
    closeMentionTooltip,
    insertMention,
    mentionFilteredUsers,
  } = useMentionTooltip(
    Boolean(isReady && isForCurrentMessageList && !hasAttachments),
    getHtml,
    setHtml,
    getSelectionRange,
    inputRef,
    groupChatMembers,
    topInlineBotIds,
    currentUserId,
  );

  const {
    isOpen: isInlineBotTooltipOpen,
    botId: inlineBotId,
    isGallery: isInlineBotTooltipGallery,
    switchPm: inlineBotSwitchPm,
    results: inlineBotResults,
    closeTooltip: closeInlineBotTooltip,
    help: inlineBotHelp,
    loadMore: loadMoreForInlineBot,
  } = useInlineBotTooltip(
    Boolean(isReady && isForCurrentMessageList && !hasAttachments && lastSyncTime),
    chatId,
    getHtml,
    inlineBots,
  );

  const {
    isOpen: isBotCommandTooltipOpen,
    close: closeBotCommandTooltip,
    filteredBotCommands: botTooltipCommands,
  } = useBotCommandTooltip(
    Boolean(isReady && isForCurrentMessageList && ((botCommands && botCommands?.length) || chatBotCommands?.length)),
    getHtml,
    botCommands,
    chatBotCommands,
  );

  const insertHtmlAndUpdateCursor = useCallback((newHtml: string, inputId: string = EDITABLE_INPUT_ID) => {
    const selection = window.getSelection()!;
    let messageInput: HTMLDivElement;
    if (inputId === EDITABLE_INPUT_ID) {
      messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR)!;
    } else {
      messageInput = document.getElementById(inputId) as HTMLDivElement;
    }

    if (selection.rangeCount) {
      const selectionRange = selection.getRangeAt(0);
      if (isSelectionInsideInput(selectionRange, inputId)) {
        insertHtmlInSelection(newHtml);
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }

    setHtml(`${getHtml()}${newHtml}`);

    // If selection is outside of input, set cursor at the end of input
    requestAnimationFrame(() => {
      focusEditableElement(messageInput);
    });
  }, [getHtml, setHtml]);

  const insertFormattedTextAndUpdateCursor = useCallback((
    text: ApiFormattedText, inputId: string = EDITABLE_INPUT_ID,
  ) => {
    const newHtml = getTextWithEntitiesAsHtml(text);
    insertHtmlAndUpdateCursor(newHtml, inputId);
  }, [insertHtmlAndUpdateCursor]);

  const insertCustomEmojiAndUpdateCursor = useCallback((emoji: ApiSticker, inputId: string = EDITABLE_INPUT_ID) => {
    insertHtmlAndUpdateCursor(buildCustomEmojiHtml(emoji), inputId);
  }, [insertHtmlAndUpdateCursor]);

  useDraft(draft, chatId, threadId, getHtml, setHtml, editingMessage, lastSyncTime);

  const resetComposer = useCallback((shouldPreserveInput = false) => {
    if (!shouldPreserveInput) {
      setHtml('');
    }

    setAttachments(MEMO_EMPTY_ARRAY);

    closeEmojiTooltip();
    closeCustomEmojiTooltip();
    closeStickerTooltip();
    closeMentionTooltip();

    if (isMobile) {
      // @optimization
      setTimeout(() => closeSymbolMenu(), SENDING_ANIMATION_DURATION);
    } else {
      closeSymbolMenu();
    }
  }, [
    setHtml, isMobile, closeStickerTooltip, closeCustomEmojiTooltip, closeMentionTooltip, closeEmojiTooltip,
    closeSymbolMenu,
  ]);

  const [handleEditComplete, handleEditCancel, shouldForceShowEditing] = useEditing(
    getHtml,
    setHtml,
    editingMessage,
    resetComposer,
    openDeleteModal,
    chatId,
    threadId,
    messageListType,
    draft,
    editingDraft,
    replyingToId,
  );

  // Handle chat change (should be placed after `useDraft` and `useEditing`)
  const resetComposerRef = useStateRef(resetComposer);
  const stopRecordingVoiceRef = useStateRef(stopRecordingVoice);
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      stopRecordingVoiceRef.current();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      resetComposerRef.current();
    };
  }, [chatId, threadId, resetComposerRef, stopRecordingVoiceRef]);

  const showCustomEmojiPremiumNotification = useCallback(() => {
    const notificationNumber = customEmojiNotificationNumber.current;
    if (!notificationNumber) {
      showNotification({
        message: lang('UnlockPremiumEmojiHint'),
        action: {
          action: 'openPremiumModal',
          payload: { initialSection: 'animated_emoji' },
        },
        actionText: lang('PremiumMore'),
      });
    } else {
      showNotification({
        message: lang('UnlockPremiumEmojiHint2'),
        action: {
          action: 'openChat',
          payload: { id: currentUserId, shouldReplaceHistory: true },
        },
        actionText: lang('Open'),
      });
    }
    customEmojiNotificationNumber.current = Number(!notificationNumber);
  }, [currentUserId, lang, showNotification]);

  const mainButtonState = useDerivedState(() => {
    if (editingMessage && shouldForceShowEditing) {
      return MainButtonState.Edit;
    }

    if (IS_VOICE_RECORDING_SUPPORTED && !activeVoiceRecording && !isForwarding && !(getHtml() && !hasAttachments)) {
      return MainButtonState.Record;
    }

    if (shouldSchedule) {
      return MainButtonState.Schedule;
    }

    return MainButtonState.Send;
  }, [
    activeVoiceRecording, editingMessage, getHtml, hasAttachments, isForwarding, shouldForceShowEditing, shouldSchedule,
  ]);
  const canShowCustomSendMenu = !shouldSchedule;

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !(mainButtonState === MainButtonState.Send && canShowCustomSendMenu));

  useClipboardPaste(
    isForCurrentMessageList,
    insertFormattedTextAndUpdateCursor,
    handleSetAttachments,
    editingMessage,
    !isCurrentUserPremium && !isChatWithSelf,
    showCustomEmojiPremiumNotification,
  );

  const handleEmbeddedClear = useCallback(() => {
    if (editingMessage) {
      handleEditCancel();
    }
  }, [editingMessage, handleEditCancel]);

  const validateTextLength = useCallback((text: string, isAttachmentModal?: boolean) => {
    const maxLength = isAttachmentModal ? captionLimit : MESSAGE_MAX_LENGTH;
    if (text?.length > maxLength) {
      const extraLength = text.length - maxLength;
      showDialog({
        data: {
          message: 'MESSAGE_TOO_LONG_PLEASE_REMOVE_CHARACTERS',
          textParams: {
            '{EXTRA_CHARS_COUNT}': extraLength.toString(),
            '{PLURAL_S}': extraLength > 1 ? 's' : '',
          },
          hasErrorKey: true,
        },
      });

      return false;
    }
    return true;
  }, [captionLimit, showDialog]);

  const checkSlowMode = useCallback(() => {
    if (slowMode && !isAdmin) {
      const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);

      const nowSeconds = getServerTime();
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

        messageInput?.blur();

        return false;
      }
    }
    return true;
  }, [isAdmin, lang, showDialog, slowMode]);

  const sendAttachments = useCallback(({
    attachments: attachmentsToSend,
    sendCompressed = attachmentSettings.shouldCompress,
    sendGrouped = attachmentSettings.shouldSendGrouped,
    isSilent,
    scheduledAt,
  }: {
    attachments: ApiAttachment[];
    sendCompressed?: boolean;
    sendGrouped?: boolean;
    isSilent?: boolean;
    scheduledAt?: number;
  }) => {
    if (connectionState !== 'connectionStateReady') {
      return;
    }

    const { text, entities } = parseMessageInput(getHtml());
    if (!text && !attachmentsToSend.length) {
      return;
    }
    if (!validateTextLength(text, true)) return;
    if (!checkSlowMode()) return;

    sendMessage({
      text,
      entities,
      scheduledAt,
      isSilent,
      shouldUpdateStickerSetsOrder: true,
      attachments: prepareAttachmentsToSend(attachmentsToSend, sendCompressed),
      shouldGroupMessages: sendGrouped,
    });

    lastMessageSendTimeSeconds.current = getServerTime();

    clearDraft({ chatId, localOnly: true });

    // Wait until message animation starts
    requestAnimationFrame(() => {
      resetComposer();
    });
  }, [
    attachmentSettings.shouldCompress, attachmentSettings.shouldSendGrouped, connectionState, getHtml,
    validateTextLength, checkSlowMode, sendMessage, clearDraft, chatId, resetComposer,
  ]);

  const handleSendAttachments = useCallback((
    sendCompressed: boolean,
    sendGrouped: boolean,
    isSilent?: boolean,
    scheduledAt?: number,
  ) => {
    sendAttachments({
      attachments,
      sendCompressed,
      sendGrouped,
      isSilent,
      scheduledAt,
    });
  }, [attachments, sendAttachments]);

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
          { voice: { duration, waveform } },
        )];
      }
    }

    const { text, entities } = parseMessageInput(getHtml());

    if (currentAttachments.length) {
      sendAttachments({
        attachments: currentAttachments,
      });
      return;
    }

    if (!text && !isForwarding) {
      return;
    }

    if (!validateTextLength(text)) return;

    const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);

    if (text) {
      if (!checkSlowMode()) return;

      sendMessage({
        text,
        entities,
        scheduledAt,
        isSilent,
        shouldUpdateStickerSetsOrder: true,
      });
    }

    if (isForwarding) {
      forwardMessages({
        scheduledAt,
        isSilent,
      });
    }

    lastMessageSendTimeSeconds.current = getServerTime();

    clearDraft({ chatId, localOnly: true });

    if (IS_IOS && messageInput && messageInput === document.activeElement) {
      applyIosAutoCapitalizationFix(messageInput);
    }

    // Wait until message animation starts
    requestAnimationFrame(() => {
      resetComposer();
    });
  }, [
    connectionState, attachments, activeVoiceRecording, getHtml, isForwarding, validateTextLength, clearDraft,
    chatId, stopRecordingVoice, sendAttachments, checkSlowMode, sendMessage, forwardMessages, resetComposer,
  ]);

  const handleClickBotMenu = useCallback(() => {
    if (botMenuButton?.type !== 'webApp') {
      return;
    }

    callAttachBot({
      chatId, url: botMenuButton.url, threadId,
    });
  }, [botMenuButton, callAttachBot, chatId, threadId]);

  const handleActivateBotCommandMenu = useCallback(() => {
    closeSymbolMenu();
    openBotCommandMenu();
  }, [closeSymbolMenu, openBotCommandMenu]);

  const handleMessageSchedule = useCallback((
    args: ScheduledMessageArgs, scheduledAt: number,
  ) => {
    if (args && 'queryId' in args) {
      const { id, queryId, isSilent } = args;
      sendInlineBotResult({
        id,
        queryId,
        scheduledAt,
        isSilent,
      });
      return;
    }

    const { isSilent, ...restArgs } = args || {};

    if (!args || Object.keys(restArgs).length === 0) {
      void handleSend(Boolean(isSilent), scheduledAt);
    } else if (args.sendCompressed !== undefined || args.sendGrouped !== undefined) {
      const { sendCompressed = false, sendGrouped = false } = args;
      void handleSendAttachments(sendCompressed, sendGrouped, isSilent, scheduledAt);
    } else {
      sendMessage({
        ...args,
        scheduledAt,
      });
    }
  }, [handleSendAttachments, handleSend, sendInlineBotResult, sendMessage]);

  useEffect(() => {
    if (contentToBeScheduled) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule(contentToBeScheduled, scheduledAt);
      });
    }
  }, [contentToBeScheduled, handleMessageSchedule, requestCalendar]);

  useEffect(() => {
    if (requestedDraftText) {
      setHtml(requestedDraftText);
      resetOpenChatWithDraft();
      requestAnimationFrame(() => {
        const messageInput = document.getElementById(EDITABLE_INPUT_ID)!;
        focusEditableElement(messageInput, true);
      });
    }
  }, [requestedDraftText, resetOpenChatWithDraft, setHtml]);

  useEffect(() => {
    if (requestedDraftFiles?.length) {
      handleFileSelect(requestedDraftFiles);
      resetOpenChatWithDraft();
    }
  }, [handleFileSelect, requestedDraftFiles, resetOpenChatWithDraft]);

  const handleCustomEmojiSelect = useCallback((emoji: ApiSticker, inputId?: string) => {
    if (!emoji.isFree && !isCurrentUserPremium && !isChatWithSelf) {
      showCustomEmojiPremiumNotification();
      return;
    }

    insertCustomEmojiAndUpdateCursor(emoji, inputId);
  }, [insertCustomEmojiAndUpdateCursor, isChatWithSelf, isCurrentUserPremium, showCustomEmojiPremiumNotification]);

  const handleCustomEmojiSelectAttachmentModal = useCallback((emoji: ApiSticker) => {
    handleCustomEmojiSelect(emoji, EDITABLE_INPUT_MODAL_ID);
  }, [handleCustomEmojiSelect]);

  const handleGifSelect = useCallback((gif: ApiVideo, isSilent?: boolean, isScheduleRequested?: boolean) => {
    if (shouldSchedule || isScheduleRequested) {
      forceShowSymbolMenu();
      requestCalendar((scheduledAt) => {
        cancelForceShowSymbolMenu();
        handleMessageSchedule({ gif, isSilent }, scheduledAt);
        requestAnimationFrame(() => {
          resetComposer(true);
        });
      });
    } else {
      sendMessage({ gif, isSilent });
      requestAnimationFrame(() => {
        resetComposer(true);
      });
    }
  }, [
    shouldSchedule, forceShowSymbolMenu, requestCalendar, cancelForceShowSymbolMenu, handleMessageSchedule,
    resetComposer, sendMessage,
  ]);

  const handleStickerSelect = useCallback((
    sticker: ApiSticker,
    isSilent?: boolean,
    isScheduleRequested?: boolean,
    shouldPreserveInput = false,
    shouldUpdateStickerSetsOrder?: boolean,
  ) => {
    sticker = {
      ...sticker,
      isPreloadedGlobally: true,
    };

    if (shouldSchedule || isScheduleRequested) {
      forceShowSymbolMenu();
      requestCalendar((scheduledAt) => {
        cancelForceShowSymbolMenu();
        handleMessageSchedule({ sticker, isSilent }, scheduledAt);
        requestAnimationFrame(() => {
          resetComposer(shouldPreserveInput);
        });
      });
    } else {
      sendMessage({ sticker, isSilent, shouldUpdateStickerSetsOrder });
      requestAnimationFrame(() => {
        resetComposer(shouldPreserveInput);
      });
    }
  }, [
    shouldSchedule, forceShowSymbolMenu, requestCalendar, cancelForceShowSymbolMenu, handleMessageSchedule,
    resetComposer, sendMessage,
  ]);

  const handleInlineBotSelect = useCallback((
    inlineResult: ApiBotInlineResult | ApiBotInlineMediaResult, isSilent?: boolean, isScheduleRequested?: boolean,
  ) => {
    if (connectionState !== 'connectionStateReady') {
      return;
    }

    if (shouldSchedule || isScheduleRequested) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule({
          id: inlineResult.id,
          queryId: inlineResult.queryId,
          isSilent,
        }, scheduledAt);
      });
    } else {
      sendInlineBotResult({
        id: inlineResult.id,
        queryId: inlineResult.queryId,
        isSilent,
      });
    }

    const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
    if (IS_IOS && messageInput && messageInput === document.activeElement) {
      applyIosAutoCapitalizationFix(messageInput);
    }

    clearDraft({ chatId, localOnly: true });
    requestAnimationFrame(() => {
      resetComposer();
    });
  }, [
    chatId, clearDraft, connectionState, handleMessageSchedule, requestCalendar, resetComposer, sendInlineBotResult,
    shouldSchedule,
  ]);

  const handleBotCommandSelect = useCallback(() => {
    clearDraft({ chatId, localOnly: true });
    requestAnimationFrame(() => {
      resetComposer();
    });
  }, [chatId, clearDraft, resetComposer]);

  const handlePollSend = useCallback((poll: ApiNewPoll) => {
    if (shouldSchedule) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule({ poll }, scheduledAt);
      });
      closePollModal();
    } else {
      sendMessage({ poll });
      closePollModal();
    }
  }, [closePollModal, handleMessageSchedule, requestCalendar, sendMessage, shouldSchedule]);

  const sendSilent = useCallback((additionalArgs?: ScheduledMessageArgs) => {
    if (shouldSchedule) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule({ ...additionalArgs, isSilent: true }, scheduledAt);
      });
    } else if (additionalArgs && ('sendCompressed' in additionalArgs || 'sendGrouped' in additionalArgs)) {
      const { sendCompressed = false, sendGrouped = false } = additionalArgs;
      void handleSendAttachments(sendCompressed, sendGrouped, true);
    } else {
      void handleSend(true);
    }
  }, [handleMessageSchedule, handleSend, handleSendAttachments, requestCalendar, shouldSchedule]);

  const handleSendAsMenuOpen = useCallback(() => {
    const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);

    if (!isMobile || messageInput !== document.activeElement) {
      closeBotCommandMenu();
      closeSymbolMenu();
      openSendAsMenu();
      return;
    }

    messageInput?.blur();
    setTimeout(() => {
      closeBotCommandMenu();
      closeSymbolMenu();
      openSendAsMenu();
    }, MOBILE_KEYBOARD_HIDE_DELAY_MS);
  }, [closeBotCommandMenu, closeSymbolMenu, openSendAsMenu, isMobile]);

  const insertTextAndUpdateCursor = useCallback((text: string, inputId: string = EDITABLE_INPUT_ID) => {
    const newHtml = renderText(text, ['escape_html', 'emoji_html', 'br_html'])
      .join('')
      .replace(/\u200b+/g, '\u200b');
    insertHtmlAndUpdateCursor(newHtml, inputId);
  }, [insertHtmlAndUpdateCursor]);

  const insertTextAndUpdateCursorAttachmentModal = useCallback((text: string) => {
    insertTextAndUpdateCursor(text, EDITABLE_INPUT_MODAL_ID);
  }, [insertTextAndUpdateCursor]);

  const removeSymbol = useCallback((inputId = EDITABLE_INPUT_ID) => {
    const selection = window.getSelection()!;

    if (selection.rangeCount) {
      const selectionRange = selection.getRangeAt(0);
      if (isSelectionInsideInput(selectionRange, inputId)) {
        document.execCommand('delete', false);
        return;
      }
    }

    setHtml(deleteLastCharacterOutsideSelection(getHtml()));
  }, [getHtml, setHtml]);

  const removeSymbolAttachmentModal = useCallback(() => {
    removeSymbol(EDITABLE_INPUT_MODAL_ID);
  }, [removeSymbol]);

  const handleAllScheduledClick = useCallback(() => {
    openChat({
      id: chatId, threadId, type: 'scheduled', noForumTopicPanel: true,
    });
  }, [openChat, chatId, threadId]);

  useEffect(() => {
    if (isRightColumnShown && isMobile) {
      closeSymbolMenu();
    }
  }, [isRightColumnShown, closeSymbolMenu, isMobile]);

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

  const areVoiceMessagesNotAllowed = mainButtonState === MainButtonState.Record
    && (!canAttachMedia || !canSendVoiceByPrivacy);

  const mainButtonHandler = useCallback(() => {
    switch (mainButtonState) {
      case MainButtonState.Send:
        handleSend();
        break;
      case MainButtonState.Record: {
        if (areVoiceMessagesNotAllowed) {
          if (!canSendVoiceByPrivacy) {
            showNotification({
              message: lang('VoiceMessagesRestrictedByPrivacy', chat?.title),
            });
          }
        } else {
          startRecordingVoice();
        }
        break;
      }
      case MainButtonState.Edit:
        handleEditComplete();
        break;
      case MainButtonState.Schedule:
        if (activeVoiceRecording) {
          pauseRecordingVoice();
        }
        requestCalendar((scheduledAt) => {
          handleMessageSchedule({}, scheduledAt);
        });
        break;
      default:
        break;
    }
  }, [
    mainButtonState, handleSend, handleEditComplete, activeVoiceRecording, requestCalendar, areVoiceMessagesNotAllowed,
    canSendVoiceByPrivacy, showNotification, lang, chat?.title, startRecordingVoice, pauseRecordingVoice,
    handleMessageSchedule,
  ]);

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
      sendButtonAriaLabel = !canAttachMedia
        ? 'Conversation.DefaultRestrictedMedia'
        : 'AccDescrVoiceMessage';
  }

  const className = buildClassName(
    'Composer',
    !isSelectModeActive && 'shown',
    isHoverDisabled && 'hover-disabled',
  );

  const handleSendScheduled = useCallback(() => {
    requestCalendar((scheduledAt) => {
      handleMessageSchedule({}, scheduledAt);
    });
  }, [handleMessageSchedule, requestCalendar]);

  const handleSendSilent = useCallback(() => {
    sendSilent();
  }, [sendSilent]);

  const handleSendScheduledAttachments = useCallback((sendCompressed: boolean, sendGrouped: boolean) => {
    requestCalendar((scheduledAt) => {
      handleMessageSchedule({ sendCompressed, sendGrouped }, scheduledAt);
    });
  }, [handleMessageSchedule, requestCalendar]);

  const handleSendSilentAttachments = useCallback((sendCompressed: boolean, sendGrouped: boolean) => {
    sendSilent({ sendCompressed, sendGrouped });
  }, [sendSilent]);

  const onSend = mainButtonState === MainButtonState.Edit
    ? handleEditComplete
    : mainButtonState === MainButtonState.Schedule ? handleSendScheduled
      : handleSend;

  const withBotMenuButton = isChatWithBot && botMenuButton?.type === 'webApp' && !editingMessage;
  const isBotMenuButtonOpen = useDerivedState(() => {
    return withBotMenuButton && !getHtml() && !activeVoiceRecording;
  }, [withBotMenuButton, getHtml, activeVoiceRecording]);

  const withBotCommands = isChatWithBot && botMenuButton?.type === 'commands' && !editingMessage
    && botCommands !== false && !activeVoiceRecording;

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
        getHtml={getHtml}
        isReady={isReady}
        shouldSuggestCompression={shouldSuggestCompression}
        isForCurrentMessageList={isForCurrentMessageList}
        onCaptionUpdate={onCaptionUpdate}
        onSendSilent={handleSendSilentAttachments}
        onSend={handleSendAttachments}
        onSendScheduled={handleSendScheduledAttachments}
        onFileAppend={handleAppendFiles}
        onClear={handleClearAttachments}
        onAttachmentsUpdate={handleSetAttachments}
        onCustomEmojiSelect={handleCustomEmojiSelectAttachmentModal}
        onRemoveSymbol={removeSymbolAttachmentModal}
        onEmojiSelect={insertTextAndUpdateCursorAttachmentModal}
      />
      <PollModal
        isOpen={pollModal.isOpen}
        isQuiz={pollModal.isQuiz}
        shouldBeAnonymous={isChannel}
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
        sendAsPeerIds={sendAsPeerIds}
        isCurrentUserPremium={isCurrentUserPremium}
      />
      <MentionTooltip
        isOpen={isMentionTooltipOpen}
        filteredUsers={mentionFilteredUsers}
        onInsertUserName={insertMention}
        onClose={closeMentionTooltip}
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

        <InlineBotTooltip
          isOpen={isInlineBotTooltipOpen}
          botId={inlineBotId}
          isGallery={isInlineBotTooltipGallery}
          inlineBotResults={inlineBotResults}
          switchPm={inlineBotSwitchPm}
          loadMore={loadMoreForInlineBot}
          isSavedMessages={isChatWithSelf}
          canSendGifs={canSendGifs}
          isCurrentUserPremium={isCurrentUserPremium}
          onSelectResult={handleInlineBotSelect}
          onClose={closeInlineBotTooltip}
        />
        <ComposerEmbeddedMessage
          onClear={handleEmbeddedClear}
          shouldForceShowEditing={Boolean(shouldForceShowEditing && editingMessage)}
        />
        <WebPagePreview
          chatId={chatId}
          threadId={threadId}
          getHtml={getHtml}
          isDisabled={!canAttachEmbedLinks || hasAttachments}
        />
        <div className="message-input-wrapper">
          {withBotMenuButton && (
            <BotMenuButton
              isOpen={isBotMenuButtonOpen}
              text={botMenuButton.text}
              isDisabled={Boolean(activeVoiceRecording)}
              onClick={handleClickBotMenu}
            />
          )}
          {withBotCommands && (
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
          <SymbolMenuButton
            chatId={chatId}
            threadId={threadId}
            isMobile={isMobile}
            isReady={isReady}
            isSymbolMenuOpen={isSymbolMenuOpen}
            openSymbolMenu={openSymbolMenu}
            closeSymbolMenu={closeSymbolMenu}
            canSendStickers={canSendStickers}
            canSendGifs={canSendGifs}
            onGifSelect={handleGifSelect}
            onStickerSelect={handleStickerSelect}
            onCustomEmojiSelect={handleCustomEmojiSelect}
            onRemoveSymbol={removeSymbol}
            onEmojiSelect={insertTextAndUpdateCursor}
            closeBotCommandMenu={closeBotCommandMenu}
            closeSendAsMenu={closeSendAsMenu}
            isSymbolMenuForced={isSymbolMenuForced}
          />
          <MessageInput
            ref={inputRef}
            id="message-input-text"
            editableInputId={EDITABLE_INPUT_ID}
            chatId={chatId}
            threadId={threadId}
            isActive={!hasAttachments}
            getHtml={getHtml}
            placeholder={
              activeVoiceRecording && windowWidth <= SCREEN_WIDTH_TO_HIDE_PLACEHOLDER
                ? ''
                : botKeyboardPlaceholder || lang('Message')
            }
            forcedPlaceholder={inlineBotHelp}
            canAutoFocus={isReady && isForCurrentMessageList && !hasAttachments}
            noFocusInterception={hasAttachments}
            shouldSuppressFocus={isMobile && isSymbolMenuOpen}
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
          {Boolean(botKeyboardMessageId) && !activeVoiceRecording && !editingMessage && (
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
          {activeVoiceRecording && Boolean(currentRecordTime) && (
            <span className="recording-state">
              {formatVoiceRecordDuration(currentRecordTime - startRecordTimeRef.current!)}
            </span>
          )}
          <AttachMenu
            chatId={chatId}
            threadId={threadId}
            isButtonVisible={!activeVoiceRecording && !editingMessage}
            canAttachMedia={canAttachMedia}
            canAttachPolls={canAttachPolls}
            onFileSelect={handleFileSelect}
            onPollCreate={openPollModal}
            isScheduled={shouldSchedule}
            attachBots={attachBots}
            peerType={attachMenuPeerType}
            theme={theme}
          />
          {Boolean(botKeyboardMessageId) && (
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
          <CustomEmojiTooltip
            chatId={chatId}
            isOpen={isCustomEmojiTooltipOpen}
            onCustomEmojiSelect={insertCustomEmoji}
            addRecentCustomEmoji={addRecentCustomEmoji}
            onClose={closeCustomEmojiTooltip}
          />
          <StickerTooltip
            chatId={chatId}
            threadId={threadId}
            isOpen={isStickerTooltipOpen}
            onStickerSelect={handleStickerSelect}
            onClose={closeStickerTooltip}
          />
          <EmojiTooltip
            isOpen={isEmojiTooltipOpen}
            emojis={filteredEmojis}
            customEmojis={filteredCustomEmojis}
            addRecentEmoji={addRecentEmoji}
            addRecentCustomEmoji={addRecentCustomEmoji}
            onEmojiSelect={insertEmoji}
            onCustomEmojiSelect={insertEmoji}
            onClose={closeEmojiTooltip}
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
        allowDisabledClick
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
          onSendSilent={!isChatWithSelf ? handleSendSilent : undefined}
          onSendSchedule={!shouldSchedule ? handleSendScheduled : undefined}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          isSavedMessages={isChatWithSelf}
        />
      )}
      {calendar}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    chatId, threadId, messageListType, isMobile,
  }): StateProps => {
    const chat = selectChat(global, chatId);
    const chatBot = chatId !== REPLIES_USER_ID ? selectChatBot(global, chatId) : undefined;
    const isChatWithBot = Boolean(chatBot);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isChatWithUser = isUserId(chatId);
    const messageWithActualBotKeyboard = (isChatWithBot || !isChatWithUser)
      && selectNewestMessageWithBotKeyboardButtons(global, chatId, threadId);
    const scheduledIds = selectScheduledIds(global, chatId, threadId);
    const { language, shouldSuggestStickers, shouldSuggestCustomEmoji } = global.settings.byKey;
    const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
    const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;
    const botKeyboardMessageId = messageWithActualBotKeyboard ? messageWithActualBotKeyboard.id : undefined;
    const keyboardMessage = botKeyboardMessageId ? selectChatMessage(global, chatId, botKeyboardMessageId) : undefined;
    const { currentUserId } = global;
    const defaultSendAsId = chat?.fullInfo ? chat?.fullInfo?.sendAsId || currentUserId : undefined;
    const sendAsId = chat?.sendAsPeerIds && defaultSendAsId && (
      chat.sendAsPeerIds.some((peer) => peer.id === defaultSendAsId)
        ? defaultSendAsId
        : (chat?.adminRights?.anonymous ? chat?.id : undefined)
    );
    const sendAsUser = sendAsId ? selectUser(global, sendAsId) : undefined;
    const sendAsChat = !sendAsUser && sendAsId ? selectChat(global, sendAsId) : undefined;
    const requestedDraftText = selectRequestedDraftText(global, chatId);
    const requestedDraftFiles = selectRequestedDraftFiles(global, chatId);
    const currentMessageList = selectCurrentMessageList(global);
    const isForCurrentMessageList = chatId === currentMessageList?.chatId
      && threadId === currentMessageList?.threadId
      && messageListType === currentMessageList?.type;
    const user = selectUser(global, chatId);
    const canSendVoiceByPrivacy = (user && !user.fullInfo?.noVoiceMessages) ?? true;

    const editingDraft = messageListType === 'scheduled'
      ? selectEditingScheduledDraft(global, chatId)
      : selectEditingDraft(global, chatId, threadId);

    const replyingToId = selectReplyingToId(global, chatId, threadId);

    const tabState = selectTabState(global);

    return {
      editingMessage: selectEditingMessage(global, chatId, threadId, messageListType),
      connectionState: global.connectionState,
      replyingToId,
      draft: selectDraft(global, chatId, threadId),
      chat,
      isChatWithBot,
      isChatWithSelf,
      isForCurrentMessageList,
      canScheduleUntilOnline: selectCanScheduleUntilOnline(global, chatId),
      isChannel: chat ? isChatChannel(chat) : undefined,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      isSelectModeActive: selectIsInSelectMode(global),
      withScheduledButton: (
        messageListType === 'thread'
        && Boolean(scheduledIds?.length)
      ),
      shouldSchedule: messageListType === 'scheduled',
      botKeyboardMessageId,
      botKeyboardPlaceholder: keyboardMessage?.keyboardPlaceholder,
      isForwarding: chatId === tabState.forwardMessages.toChatId,
      pollModal: tabState.pollModal,
      stickersForEmoji: global.stickers.forEmoji.stickers,
      customEmojiForEmoji: global.customEmojis.forEmoji.stickers,
      groupChatMembers: chat?.fullInfo?.members,
      topInlineBotIds: global.topInlineBots?.userIds,
      currentUserId,
      lastSyncTime: global.lastSyncTime,
      contentToBeScheduled: tabState.contentToBeScheduled,
      shouldSuggestStickers,
      shouldSuggestCustomEmoji,
      recentEmojis: global.recentEmojis,
      baseEmojiKeywords: baseEmojiKeywords?.keywords,
      emojiKeywords: emojiKeywords?.keywords,
      inlineBots: tabState.inlineBots.byUsername,
      isInlineBotLoading: tabState.inlineBots.isLoading,
      chatBotCommands: chat?.fullInfo && chat.fullInfo.botCommands,
      botCommands: chatBot?.fullInfo ? (chatBot.fullInfo.botInfo?.commands || false) : undefined,
      botMenuButton: chatBot?.fullInfo?.botInfo?.menuButton,
      sendAsUser,
      sendAsChat,
      sendAsId,
      editingDraft,
      requestedDraftText,
      requestedDraftFiles,
      attachBots: global.attachMenu.bots,
      attachMenuPeerType: selectChatType(global, chatId),
      theme: selectTheme(global),
      fileSizeLimit: selectCurrentLimit(global, 'uploadMaxFileparts') * MAX_UPLOAD_FILEPART_SIZE,
      captionLimit: selectCurrentLimit(global, 'captionLength'),
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      canSendVoiceByPrivacy,
      attachmentSettings: global.attachmentSettings,
    };
  },
)(Composer));
