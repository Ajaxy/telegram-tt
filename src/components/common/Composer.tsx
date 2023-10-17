import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiAttachment,
  ApiAttachMenuPeerType,
  ApiAvailableReaction,
  ApiBotCommand,
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiBotMenuButton,
  ApiChat,
  ApiChatFullInfo,
  ApiChatMember,
  ApiFormattedText,
  ApiMessage,
  ApiMessageEntity,
  ApiNewPoll,
  ApiReaction,
  ApiStealthMode,
  ApiSticker,
  ApiUser,
  ApiVideo,
} from '../../api/types';
import type {
  ApiDraft, GlobalState, MessageList,
  MessageListType, TabState,
} from '../../global/types';
import type { IAnchorPosition, InlineBotSettings, ISettings } from '../../types';

import {
  BASE_EMOJI_KEYWORD_LANG,
  EDITABLE_INPUT_MODAL_ID,
  HEART_REACTION,
  MAX_UPLOAD_FILEPART_SIZE,
  QUOTE_APP as QUOTE_APP_CONSTANTS,
  REPLIES_USER_ID,
  SCHEDULED_WHEN_ONLINE,
  SEND_MESSAGE_ACTION_INTERVAL,
} from '../../config';
import { requestMeasure, requestNextMutation } from '../../lib/fasterdom/fasterdom';
import {
  getAllowedAttachmentOptions,
  getStoryKey,
  isChatAdmin,
  isChatChannel,
  isChatSuperGroup,
  isMainThread,
  isUserId,
  QUOTE_APP as QUOTE_APP_UTILS,
} from '../../global/helpers';
import {
  selectBot,
  selectCanPlayAnimatedEmojis,
  selectCanScheduleUntilOnline,
  selectChat,
  selectChatFullInfo,
  selectChatMessage,
  selectChatType,
  selectCurrentMessageList,
  selectDraft,
  selectEditingDraft,
  selectEditingMessage,
  selectEditingScheduledDraft,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectIsInSelectMode,
  selectIsPremiumPurchaseBlocked,
  selectIsReactionPickerOpen,
  selectIsRightColumnShown,
  selectNewestMessageWithBotKeyboardButtons,
  selectPeerStory,
  selectReplyingToId,
  selectRequestedDraftFiles,
  selectRequestedDraftText,
  selectScheduledIds,
  selectTabState,
  selectTheme,
  selectUser,
  selectUserFullInfo,
} from '../../global/selectors';
import { selectCurrentLimit } from '../../global/selectors/limits';
import buildClassName from '../../util/buildClassName';
import { processMessageInputForCustomEmoji } from '../../util/customEmojiManager';
import { formatMediaDuration, formatVoiceRecordDuration } from '../../util/dateFormat';
import deleteLastCharacterOutsideSelection from '../../util/deleteLastCharacterOutsideSelection';
import focusEditableElement from '../../util/focusEditableElement';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import parseMessageInput from '../../util/parseMessageInput';
import { insertHtmlInSelection } from '../../util/selection';
import { getServerTime } from '../../util/serverTime';
import { IS_IOS, IS_VOICE_RECORDING_SUPPORTED } from '../../util/windowEnvironment';
import windowSize from '../../util/windowSize';
import applyIosAutoCapitalizationFix from '../middle/composer/helpers/applyIosAutoCapitalizationFix';
import buildAttachment, { prepareAttachmentsToSend } from '../middle/composer/helpers/buildAttachment';
import { buildCustomEmojiHtml } from '../middle/composer/helpers/customEmoji';
import { isSelectionInsideInput } from '../middle/composer/helpers/selection';
import renderText from './helpers/renderText';
import { getTextWithEntitiesAsHtml } from './helpers/renderTextWithEntities';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useDerivedState from '../../hooks/useDerivedState';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useFlag from '../../hooks/useFlag';
import useGetSelectionRange from '../../hooks/useGetSelectionRange';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';
import useSchedule from '../../hooks/useSchedule';
import useSendMessageAction from '../../hooks/useSendMessageAction';
import useShowTransition from '../../hooks/useShowTransition';
import useSignal from '../../hooks/useSignal';
import { useStateRef } from '../../hooks/useStateRef';
import useSyncEffect from '../../hooks/useSyncEffect';
import useTimeout from '../../hooks/useTimeout';
import useAttachmentModal from '../middle/composer/hooks/useAttachmentModal';
import useBotCommandTooltip from '../middle/composer/hooks/useBotCommandTooltip';
import useClipboardPaste from '../middle/composer/hooks/useClipboardPaste';
import useCustomEmojiTooltip from '../middle/composer/hooks/useCustomEmojiTooltip';
import useDraft from '../middle/composer/hooks/useDraft';
import useEditing from '../middle/composer/hooks/useEditing';
import useEmojiTooltip from '../middle/composer/hooks/useEmojiTooltip';
import useInlineBotTooltip from '../middle/composer/hooks/useInlineBotTooltip';
import useMentionTooltip from '../middle/composer/hooks/useMentionTooltip';
import useStickerTooltip from '../middle/composer/hooks/useStickerTooltip';
import useVoiceRecording from '../middle/composer/hooks/useVoiceRecording';

import AttachmentModal from '../middle/composer/AttachmentModal.async';
import AttachMenu from '../middle/composer/AttachMenu';
import BotCommandMenu from '../middle/composer/BotCommandMenu.async';
import BotCommandTooltip from '../middle/composer/BotCommandTooltip.async';
import BotKeyboardMenu from '../middle/composer/BotKeyboardMenu';
import BotMenuButton from '../middle/composer/BotMenuButton';
import ComposerEmbeddedMessage from '../middle/composer/ComposerEmbeddedMessage';
import CustomEmojiTooltip from '../middle/composer/CustomEmojiTooltip.async';
import CustomSendMenu from '../middle/composer/CustomSendMenu.async';
import DropArea, { DropAreaState } from '../middle/composer/DropArea.async';
import EmojiTooltip from '../middle/composer/EmojiTooltip.async';
import InlineBotTooltip from '../middle/composer/InlineBotTooltip.async';
import MentionTooltip from '../middle/composer/MentionTooltip.async';
import MessageInput from '../middle/composer/MessageInput';
import PollModal from '../middle/composer/PollModal.async';
import SendAsMenu from '../middle/composer/SendAsMenu.async';
import StickerTooltip from '../middle/composer/StickerTooltip.async';
import SymbolMenuButton from '../middle/composer/SymbolMenuButton';
import WebPagePreview from '../middle/composer/WebPagePreview';
import ReactionSelector from '../middle/message/ReactionSelector';
import Button from '../ui/Button';
import ResponsiveHoverButton from '../ui/ResponsiveHoverButton';
import Spinner from '../ui/Spinner';
import Avatar from './Avatar';
import DeleteMessageModal from './DeleteMessageModal.async';
import ReactionAnimatedEmoji from './reactions/ReactionAnimatedEmoji';

import './Composer.scss';

type ComposerType = 'messageList' | 'story';

type OwnProps = {
  type: ComposerType;
  chatId: string;
  threadId: number;
  storyId?: number;
  messageListType: MessageListType;
  dropAreaState?: string;
  isReady: boolean;
  isMobile?: boolean;
  onDropHide?: NoneToVoidFunction;
  inputId: string;
  editableInputCssSelector: string;
  editableInputId: string;
  className?: string;
  inputPlaceholder?: string;
  onForward?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
};

type StateProps =
  {
    isOnActiveTab: boolean;
    editingMessage?: ApiMessage;
    chat?: ApiChat;
    draft?: ApiDraft;
    currentMessageList?: MessageList;
    isChatWithBot?: boolean;
    isChatWithSelf?: boolean;
    isChannel?: boolean;
    replyingToId?: number;
    isForCurrentMessageList: boolean;
    isRightColumnShown?: boolean;
    isSelectModeActive?: boolean;
    isReactionPickerOpen?: boolean;
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
    slowMode?: ApiChatFullInfo['slowMode'];
    shouldUpdateStickerSetOrder?: boolean;
    availableReactions?: ApiAvailableReaction[];
    topReactions?: ApiReaction[];
    canPlayAnimatedEmojis?: boolean;
    canBuyPremium?: boolean;
    shouldCollectDebugLogs?: boolean;
    sentStoryReaction?: ApiReaction;
    stealthMode?: ApiStealthMode;
  };

enum MainButtonState {
  Send = 'send',
  Record = 'record',
  Edit = 'edit',
  Schedule = 'schedule',
  Forward = 'forward',
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
const MOUNT_ANIMATION_DURATION = 430;

const Composer: FC<OwnProps & StateProps> = ({
  type,
  isOnActiveTab,
  dropAreaState,
  shouldSchedule,
  canScheduleUntilOnline,
  isReady,
  isMobile,
  onDropHide,
  onFocus,
  onBlur,
  editingMessage,
  chatId,
  threadId,
  storyId,
  currentMessageList,
  messageListType,
  draft,
  chat,
  isForCurrentMessageList,
  isCurrentUserPremium,
  canSendVoiceByPrivacy,
  isChatWithBot,
  isChatWithSelf,
  isChannel,
  fileSizeLimit,
  isRightColumnShown,
  isSelectModeActive,
  isReactionPickerOpen,
  isForwarding,
  pollModal,
  botKeyboardMessageId,
  botKeyboardPlaceholder,
  inputPlaceholder,
  withScheduledButton,
  stickersForEmoji,
  customEmojiForEmoji,
  groupChatMembers,
  topInlineBotIds,
  currentUserId,
  captionLimit,
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
  slowMode,
  shouldUpdateStickerSetOrder,
  editableInputCssSelector,
  editableInputId,
  inputId,
  className,
  availableReactions,
  topReactions,
  canBuyPremium,
  canPlayAnimatedEmojis,
  shouldCollectDebugLogs,
  sentStoryReaction,
  stealthMode,
  onForward,
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
    showAllowedMessageTypesNotification,
    openStoryReactionPicker,
    closeReactionPicker,
    sendStoryReaction,
  } = getActions();

  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const storyReactionRef = useRef<HTMLButtonElement>(null);

  const [getHtml, setHtml] = useSignal('');
  const [isMounted, setIsMounted] = useState(false);
  const getSelectionRange = useGetSelectionRange(editableInputCssSelector);
  const lastMessageSendTimeSeconds = useRef<number>();
  const prevDropAreaState = usePrevious(dropAreaState);
  const { width: windowWidth } = windowSize.get();

  const isInMessageList = type === 'messageList';
  const isInStoryViewer = type === 'story';
  const sendAsPeerIds = isInMessageList ? chat?.sendAsPeerIds : undefined;
  const canShowSendAs = sendAsPeerIds
    && (sendAsPeerIds.length > 1 || !sendAsPeerIds.some((peer) => peer.id === currentUserId!));
  // Prevent Symbol Menu from closing when calendar is open
  const [isSymbolMenuForced, forceShowSymbolMenu, cancelForceShowSymbolMenu] = useFlag();
  const sendMessageAction = useSendMessageAction(chatId, threadId);
  const [isInputHasFocus, markInputHasFocus, unmarkInputHasFocus] = useFlag();
  const [isAttachMenuOpen, onAttachMenuOpen, onAttachMenuClose] = useFlag();

  const isSentStoryReactionHeart = sentStoryReaction && 'emoticon' in sentStoryReaction
    ? sentStoryReaction.emoticon === HEART_REACTION.emoticon : false;

  useEffect(processMessageInputForCustomEmoji, [getHtml]);

  const customEmojiNotificationNumber = useRef(0);

  const [requestCalendar, calendar] = useSchedule(
    isInMessageList && canScheduleUntilOnline,
    cancelForceShowSymbolMenu,
  );

  useTimeout(() => {
    setIsMounted(true);
  }, MOUNT_ANIMATION_DURATION);

  useEffect(() => {
    if (isInMessageList) return;

    closeReactionPicker();
  }, [isInMessageList, storyId]);

  useEffect(() => {
    lastMessageSendTimeSeconds.current = undefined;
  }, [chatId]);

  useEffect(() => {
    if (chatId && isReady && !isInStoryViewer) {
      loadScheduledHistory({ chatId });
    }
  }, [isReady, chatId, threadId, isInStoryViewer]);

  useEffect(() => {
    if (chatId && chat && !sendAsPeerIds && isReady && isChatSuperGroup(chat)) {
      loadSendAs({ chatId });
    }
  }, [chat, chatId, isReady, loadSendAs, sendAsPeerIds]);

  const shouldAnimateSendAsButtonRef = useRef(false);
  useSyncEffect(([prevChatId, prevSendAsPeerIds]) => {
    // We only animate send-as button if `sendAsPeerIds` was missing when opening the chat
    shouldAnimateSendAsButtonRef.current = Boolean(chatId === prevChatId && sendAsPeerIds && !prevSendAsPeerIds);
  }, [chatId, sendAsPeerIds]);

  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);
  const hasAttachments = Boolean(attachments.length);
  const [nextText, setNextText] = useState<ApiFormattedText | undefined>(undefined);

  const {
    canSendStickers, canSendGifs, canAttachMedia, canAttachPolls, canAttachEmbedLinks,
    canSendVoices, canSendPlainText, canSendAudios, canSendVideos, canSendPhotos, canSendDocuments,
  } = useMemo(
    () => getAllowedAttachmentOptions(chat, isChatWithBot, isInStoryViewer),
    [chat, isChatWithBot, isInStoryViewer],
  );

  const isComposerBlocked = !canSendPlainText && !editingMessage;

  const insertHtmlAndUpdateCursor = useLastCallback((newHtml: string, inInputId: string = editableInputId) => {
    if (inInputId === editableInputId && isComposerBlocked) return;
    const selection = window.getSelection()!;
    let messageInput: HTMLDivElement;
    if (inInputId === editableInputId) {
      messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector)!;
    } else {
      messageInput = document.getElementById(inInputId) as HTMLDivElement;
    }

    if (selection.rangeCount) {
      const selectionRange = selection.getRangeAt(0);
      if (isSelectionInsideInput(selectionRange, inInputId)) {
        insertHtmlInSelection(newHtml);
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }

    setHtml(`${getHtml()}${newHtml}`);

    // If selection is outside of input, set cursor at the end of input
    requestNextMutation(() => {
      focusEditableElement(messageInput);
    });
  });

  const insertTextAndUpdateCursor = useLastCallback((
    text: string, inInputId: string = editableInputId,
  ) => {
    const newHtml = renderText(text, ['escape_html', 'emoji_html', 'br_html'])
      .join('')
      .replace(/\u200b+/g, '\u200b');
    insertHtmlAndUpdateCursor(newHtml, inInputId);
  });

  const insertFormattedTextAndUpdateCursor = useLastCallback((
    text: ApiFormattedText, inInputId: string = editableInputId,
  ) => {
    const newHtml = getTextWithEntitiesAsHtml(text);
    insertHtmlAndUpdateCursor(newHtml, inInputId);
  });

  const insertCustomEmojiAndUpdateCursor = useLastCallback((emoji: ApiSticker, inInputId: string = editableInputId) => {
    insertHtmlAndUpdateCursor(buildCustomEmojiHtml(emoji), inInputId);
  });

  const insertNextText = useLastCallback(() => {
    if (!nextText) return;
    insertFormattedTextAndUpdateCursor(nextText, editableInputId);
    setNextText(undefined);
  });

  const {
    shouldSuggestCompression,
    shouldForceCompression,
    shouldForceAsFile,
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
    chatId,
    canSendAudios,
    canSendVideos,
    canSendPhotos,
    canSendDocuments,
    insertNextText,
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

  const shouldSendRecordingStatus = isForCurrentMessageList && !isInStoryViewer;
  useInterval(() => {
    sendMessageAction({ type: 'recordAudio' });
  }, shouldSendRecordingStatus ? activeVoiceRecording && SEND_MESSAGE_ACTION_INTERVAL : undefined);

  useEffect(() => {
    if (!isForCurrentMessageList || isInStoryViewer) return;
    if (!activeVoiceRecording) {
      sendMessageAction({ type: 'cancel' });
    }
  }, [activeVoiceRecording, isForCurrentMessageList, isInStoryViewer, sendMessageAction]);

  const isEditingRef = useStateRef(Boolean(editingMessage));
  useEffect(() => {
    if (!isForCurrentMessageList || isInStoryViewer) return;
    if (getHtml() && !isEditingRef.current) {
      sendMessageAction({ type: 'typing' });
    }
  }, [getHtml, isEditingRef, isForCurrentMessageList, isInStoryViewer, sendMessageAction]);

  const isAdmin = chat && isChatAdmin(chat);

  const {
    isEmojiTooltipOpen,
    closeEmojiTooltip,
    filteredEmojis,
    filteredCustomEmojis,
    insertEmoji,
  } = useEmojiTooltip(
    Boolean(isReady && isOnActiveTab && (isInStoryViewer || isForCurrentMessageList)
      && shouldSuggestStickers && !hasAttachments),
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
    Boolean(isReady && isOnActiveTab && (isInStoryViewer || isForCurrentMessageList)
      && shouldSuggestCustomEmoji && !hasAttachments),
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
    Boolean(isReady
      && isOnActiveTab
      && (isInStoryViewer || isForCurrentMessageList)
      && shouldSuggestStickers
      && canSendStickers
      && !hasAttachments),
    getHtml,
    stickersForEmoji,
  );

  const {
    isMentionTooltipOpen,
    closeMentionTooltip,
    insertMention,
    mentionFilteredUsers,
  } = useMentionTooltip(
    Boolean(isInMessageList && isReady && isForCurrentMessageList && !hasAttachments),
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
    switchWebview: inlineBotSwitchWebview,
    results: inlineBotResults,
    closeTooltip: closeInlineBotTooltip,
    help: inlineBotHelp,
    loadMore: loadMoreForInlineBot,
  } = useInlineBotTooltip(
    Boolean(isInMessageList && isReady && isForCurrentMessageList && !hasAttachments),
    chatId,
    getHtml,
    inlineBots,
  );

  const {
    isOpen: isBotCommandTooltipOpen,
    close: closeBotCommandTooltip,
    filteredBotCommands: botTooltipCommands,
  } = useBotCommandTooltip(
    Boolean(isInMessageList
      && isReady
      && isForCurrentMessageList
      && ((botCommands && botCommands?.length) || chatBotCommands?.length)),
    getHtml,
    botCommands,
    chatBotCommands,
  );

  useDraft({
    draft,
    chatId,
    threadId,
    getHtml,
    setHtml,
    editedMessage: editingMessage,
    isDisabled: isInStoryViewer,
  });

  const resetComposer = useLastCallback((shouldPreserveInput = false) => {
    if (!shouldPreserveInput) {
      setHtml('');
    }

    setAttachments(MEMO_EMPTY_ARRAY);
    setNextText(undefined);

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
  });

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
      // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
      stopRecordingVoiceRef.current();
      // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
      resetComposerRef.current();
    };
  }, [chatId, threadId, resetComposerRef, stopRecordingVoiceRef]);

  const showCustomEmojiPremiumNotification = useLastCallback(() => {
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
  });

  const mainButtonState = useDerivedState(() => {
    if (!isInputHasFocus && onForward && !(getHtml() && !hasAttachments)) {
      return MainButtonState.Forward;
    }

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
    activeVoiceRecording, editingMessage, getHtml, hasAttachments, isForwarding, isInputHasFocus, onForward,
    shouldForceShowEditing, shouldSchedule,
  ]);
  const canShowCustomSendMenu = !shouldSchedule;

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !(mainButtonState === MainButtonState.Send && canShowCustomSendMenu));

  const {
    contextMenuPosition: storyReactionPickerPosition,
    handleContextMenu: handleStoryPickerContextMenu,
    handleBeforeContextMenu: handleBeforeStoryPickerContextMenu,
    handleContextMenuHide: handleStoryPickerContextMenuHide,
  } = useContextMenuHandlers(storyReactionRef, !isInStoryViewer);

  useEffect(() => {
    if (isReactionPickerOpen) return;

    if (storyReactionPickerPosition) {
      openStoryReactionPicker({
        peerId: chatId,
        storyId: storyId!,
        position: storyReactionPickerPosition,
      });
      handleStoryPickerContextMenuHide();
    }
  }, [chatId, handleStoryPickerContextMenuHide, isReactionPickerOpen, storyId, storyReactionPickerPosition]);

  useClipboardPaste(
    isForCurrentMessageList || isInStoryViewer,
    insertFormattedTextAndUpdateCursor,
    handleSetAttachments,
    setNextText,
    editingMessage,
    !isCurrentUserPremium && !isChatWithSelf,
    showCustomEmojiPremiumNotification,
  );

  const handleEmbeddedClear = useLastCallback(() => {
    if (editingMessage) {
      handleEditCancel();
    }
  });

  const validateTextLength = useLastCallback((text: string, isAttachmentModal?: boolean) => {
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
  });

  const checkSlowMode = useLastCallback(() => {
    if (slowMode && !isAdmin) {
      const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);

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
  });

  const sendAttachments = useLastCallback(({
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
    if (!currentMessageList && !storyId) {
      return;
    }

    const { text, entities } = parseMessageInput(getHtml());
    if (!text && !attachmentsToSend.length) {
      return;
    }
    if (!validateTextLength(text, true)) return;
    if (!checkSlowMode()) return;

    sendMessage({
      messageList: currentMessageList,
      text,
      entities,
      scheduledAt,
      isSilent,
      shouldUpdateStickerSetOrder,
      attachments: prepareAttachmentsToSend(attachmentsToSend, sendCompressed),
      shouldGroupMessages: sendGrouped,
    });

    lastMessageSendTimeSeconds.current = getServerTime();

    clearDraft({ chatId, localOnly: true });

    // Wait until message animation starts
    requestMeasure(() => {
      resetComposer();
    });
  });

  const handleSendAttachments = useLastCallback((
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
  });

  const handleSend = useLastCallback(async (isSilent = false, scheduledAt?: number) => {
    if (!currentMessageList && !storyId) {
      return;
    }

    const shouldOpenRepliesChat = (
      replyingToId
      && QUOTE_APP_CONSTANTS.SHOULD_OPEN_REPLIES_CHAT_ON_REPLY
      && QUOTE_APP_UTILS.doesChatSupportThreads(chat)
    );
    const repliesChatToOpen = {
      id: chatId,
      threadId: isMainThread(threadId) ? replyingToId : threadId,
    };
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
      if (shouldOpenRepliesChat) openChat(repliesChatToOpen);
      sendAttachments({
        attachments: currentAttachments,
      });
      return;
    }

    if (!text && !isForwarding) {
      return;
    }

    if (!validateTextLength(text)) return;

    const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);

    if (text) {
      if (!checkSlowMode()) return;

      sendMessage({
        messageList: currentMessageList,
        text,
        entities,
        scheduledAt,
        isSilent,
        shouldUpdateStickerSetOrder,
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
    if (shouldOpenRepliesChat) openChat(repliesChatToOpen);
    if (IS_IOS && messageInput && messageInput === document.activeElement) {
      applyIosAutoCapitalizationFix(messageInput);
    }

    // Wait until message animation starts
    requestMeasure(() => {
      resetComposer();
    });
  });

  const handleClickBotMenu = useLastCallback(() => {
    if (botMenuButton?.type !== 'webApp') {
      return;
    }

    callAttachBot({
      chatId, url: botMenuButton.url, threadId,
    });
  });

  const handleActivateBotCommandMenu = useLastCallback(() => {
    closeSymbolMenu();
    openBotCommandMenu();
  });

  const handleMessageSchedule = useLastCallback((
    args: ScheduledMessageArgs, scheduledAt: number, messageList: MessageList,
  ) => {
    if (args && 'queryId' in args) {
      const { id, queryId, isSilent } = args;
      sendInlineBotResult({
        id,
        queryId,
        scheduledAt,
        isSilent,
        messageList,
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
        messageList,
        scheduledAt,
      });
    }
  });

  useEffectWithPrevDeps(([prevContentToBeScheduled]) => {
    if (currentMessageList && contentToBeScheduled && contentToBeScheduled !== prevContentToBeScheduled) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule(contentToBeScheduled, scheduledAt, currentMessageList);
      });
    }
  }, [contentToBeScheduled, currentMessageList, handleMessageSchedule, requestCalendar]);

  useEffect(() => {
    if (requestedDraftText) {
      setHtml(requestedDraftText);
      resetOpenChatWithDraft();

      requestNextMutation(() => {
        const messageInput = document.getElementById(editableInputId)!;
        focusEditableElement(messageInput, true);
      });
    }
  }, [editableInputId, requestedDraftText, resetOpenChatWithDraft, setHtml]);

  useEffect(() => {
    if (requestedDraftFiles?.length) {
      void handleFileSelect(requestedDraftFiles);
      resetOpenChatWithDraft();
    }
  }, [handleFileSelect, requestedDraftFiles, resetOpenChatWithDraft]);

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker, inInputId?: string) => {
    if (!emoji.isFree && !isCurrentUserPremium && !isChatWithSelf) {
      showCustomEmojiPremiumNotification();
      return;
    }

    insertCustomEmojiAndUpdateCursor(emoji, inInputId);
  });

  const handleCustomEmojiSelectAttachmentModal = useLastCallback((emoji: ApiSticker) => {
    handleCustomEmojiSelect(emoji, EDITABLE_INPUT_MODAL_ID);
  });

  const handleGifSelect = useLastCallback((gif: ApiVideo, isSilent?: boolean, isScheduleRequested?: boolean) => {
    if (!currentMessageList && !storyId) {
      return;
    }

    if (shouldSchedule || isScheduleRequested) {
      forceShowSymbolMenu();
      requestCalendar((scheduledAt) => {
        cancelForceShowSymbolMenu();
        handleMessageSchedule({ gif, isSilent }, scheduledAt, currentMessageList!);
        requestMeasure(() => {
          resetComposer(true);
        });
      });
    } else {
      sendMessage({ messageList: currentMessageList, gif, isSilent });
      requestMeasure(() => {
        resetComposer(true);
      });
    }
  });

  const handleStickerSelect = useLastCallback((
    sticker: ApiSticker,
    isSilent?: boolean,
    isScheduleRequested?: boolean,
    shouldPreserveInput = false,
    canUpdateStickerSetsOrder?: boolean,
  ) => {
    if (!currentMessageList && !storyId) {
      return;
    }

    sticker = {
      ...sticker,
      isPreloadedGlobally: true,
    };

    if (shouldSchedule || isScheduleRequested) {
      forceShowSymbolMenu();
      requestCalendar((scheduledAt) => {
        cancelForceShowSymbolMenu();
        handleMessageSchedule({ sticker, isSilent }, scheduledAt, currentMessageList!);
        requestMeasure(() => {
          resetComposer(shouldPreserveInput);
        });
      });
    } else {
      sendMessage({
        messageList: currentMessageList,
        sticker,
        isSilent,
        shouldUpdateStickerSetOrder: shouldUpdateStickerSetOrder && canUpdateStickerSetsOrder,
      });
      requestMeasure(() => {
        resetComposer(shouldPreserveInput);
      });
    }
  });

  const handleInlineBotSelect = useLastCallback((
    inlineResult: ApiBotInlineResult | ApiBotInlineMediaResult, isSilent?: boolean, isScheduleRequested?: boolean,
  ) => {
    if (!currentMessageList && !storyId) {
      return;
    }

    if (shouldSchedule || isScheduleRequested) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule({
          id: inlineResult.id,
          queryId: inlineResult.queryId,
          isSilent,
        }, scheduledAt, currentMessageList!);
      });
    } else {
      sendInlineBotResult({
        id: inlineResult.id,
        queryId: inlineResult.queryId,
        isSilent,
        messageList: currentMessageList!,
      });
    }

    const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);
    if (IS_IOS && messageInput && messageInput === document.activeElement) {
      applyIosAutoCapitalizationFix(messageInput);
    }

    clearDraft({ chatId, localOnly: true });
    requestMeasure(() => {
      resetComposer();
    });
  });

  const handleBotCommandSelect = useLastCallback(() => {
    clearDraft({ chatId, localOnly: true });
    requestMeasure(() => {
      resetComposer();
    });
  });

  const handlePollSend = useLastCallback((poll: ApiNewPoll) => {
    if (!currentMessageList) {
      return;
    }

    if (shouldSchedule) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule({ poll }, scheduledAt, currentMessageList);
      });
      closePollModal();
    } else {
      sendMessage({ messageList: currentMessageList, poll });
      closePollModal();
    }
  });

  const sendSilent = useLastCallback((additionalArgs?: ScheduledMessageArgs) => {
    if (shouldSchedule) {
      requestCalendar((scheduledAt) => {
        handleMessageSchedule({ ...additionalArgs, isSilent: true }, scheduledAt, currentMessageList!);
      });
    } else if (additionalArgs && ('sendCompressed' in additionalArgs || 'sendGrouped' in additionalArgs)) {
      const { sendCompressed = false, sendGrouped = false } = additionalArgs;
      void handleSendAttachments(sendCompressed, sendGrouped, true);
    } else {
      void handleSend(true);
    }
  });

  const handleSendAsMenuOpen = useLastCallback(() => {
    const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);

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
  });

  useEffect(() => {
    if (!isComposerBlocked) return;

    setHtml('');
  }, [isComposerBlocked, setHtml, attachments]);

  const insertTextAndUpdateCursorAttachmentModal = useLastCallback((text: string) => {
    insertTextAndUpdateCursor(text, EDITABLE_INPUT_MODAL_ID);
  });

  const removeSymbol = useLastCallback((inInputId = editableInputId) => {
    const selection = window.getSelection()!;

    if (selection.rangeCount) {
      const selectionRange = selection.getRangeAt(0);
      if (isSelectionInsideInput(selectionRange, inInputId)) {
        document.execCommand('delete', false);
        return;
      }
    }

    setHtml(deleteLastCharacterOutsideSelection(getHtml()));
  });

  const removeSymbolAttachmentModal = useLastCallback(() => {
    removeSymbol(EDITABLE_INPUT_MODAL_ID);
  });

  const handleAllScheduledClick = useLastCallback(() => {
    openChat({
      id: chatId, threadId, type: 'scheduled', noForumTopicPanel: true,
    });
  });

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

  const withBotMenuButton = isChatWithBot && botMenuButton?.type === 'webApp' && !editingMessage;
  const isBotMenuButtonOpen = useDerivedState(() => {
    return withBotMenuButton && !getHtml() && !activeVoiceRecording;
  }, [withBotMenuButton, getHtml, activeVoiceRecording]);

  const [timedPlaceholderLangKey, timedPlaceholderDate] = useMemo(() => {
    if (slowMode?.nextSendDate) {
      return ['SlowModeWait', slowMode.nextSendDate];
    }

    if (stealthMode?.activeUntil && isInStoryViewer) {
      return ['StealthModeActiveHint', stealthMode.activeUntil];
    }

    return [];
  }, [isInStoryViewer, slowMode?.nextSendDate, stealthMode?.activeUntil]);

  const isComposerHasFocus = isBotKeyboardOpen || isSymbolMenuOpen || isEmojiTooltipOpen || isSendAsMenuOpen
    || isMentionTooltipOpen || isInlineBotTooltipOpen || isDeleteModalOpen || isBotCommandMenuOpen || isAttachMenuOpen
    || isStickerTooltipOpen || isBotCommandTooltipOpen || isCustomEmojiTooltipOpen || isBotMenuButtonOpen
  || isCustomSendMenuOpen || Boolean(activeVoiceRecording) || attachments.length > 0 || isInputHasFocus;
  const isReactionSelectorOpen = isComposerHasFocus && !isReactionPickerOpen && isInStoryViewer && !isAttachMenuOpen
    && !isSymbolMenuOpen;

  useEffect(() => {
    if (isComposerHasFocus) {
      onFocus?.();
    } else {
      onBlur?.();
    }
  }, [isComposerHasFocus, onBlur, onFocus]);

  const {
    shouldRender: shouldRenderReactionSelector,
    transitionClassNames: reactionSelectorTransitonClassNames,
  } = useShowTransition(isReactionSelectorOpen);
  const areVoiceMessagesNotAllowed = mainButtonState === MainButtonState.Record
    && (!canAttachMedia || !canSendVoiceByPrivacy || !canSendVoices);

  const mainButtonHandler = useLastCallback(() => {
    switch (mainButtonState) {
      case MainButtonState.Forward:
        onForward?.();
        break;
      case MainButtonState.Send:
        void handleSend();
        break;
      case MainButtonState.Record: {
        if (areVoiceMessagesNotAllowed) {
          if (!canSendVoiceByPrivacy) {
            showNotification({
              message: lang('VoiceMessagesRestrictedByPrivacy', chat?.title),
            });
          } else if (!canSendVoices) {
            showAllowedMessageTypesNotification({ chatId });
          }
        } else {
          void startRecordingVoice();
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
        if (!currentMessageList) {
          return;
        }

        requestCalendar((scheduledAt) => {
          handleMessageSchedule({}, scheduledAt, currentMessageList!);
        });
        break;
      default:
        break;
    }
  });

  const prevEditedMessage = usePrevious(editingMessage, true);
  const renderedEditedMessage = editingMessage || prevEditedMessage;

  const scheduledDefaultDate = new Date();
  scheduledDefaultDate.setSeconds(0);
  scheduledDefaultDate.setMilliseconds(0);

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  let sendButtonAriaLabel = 'SendMessage';
  switch (mainButtonState) {
    case MainButtonState.Forward:
      sendButtonAriaLabel = 'Forward';
      break;
    case MainButtonState.Edit:
      sendButtonAriaLabel = 'Save edited message';
      break;
    case MainButtonState.Record:
      sendButtonAriaLabel = !canAttachMedia
        ? 'Conversation.DefaultRestrictedMedia'
        : 'AccDescrVoiceMessage';
  }

  const fullClassName = buildClassName(
    'Composer',
    !isSelectModeActive && 'shown',
    isHoverDisabled && 'hover-disabled',
    isMounted && 'mounted',
    className,
  );

  const handleToggleReaction = useLastCallback((reaction: ApiReaction) => {
    let text: string | undefined;
    let entities: ApiMessageEntity[] | undefined;

    if ('emoticon' in reaction) {
      text = reaction.emoticon;
    } else {
      const sticker = getGlobal().customEmojis.byId[reaction.documentId];
      if (!sticker) {
        return;
      }

      if (!sticker.isFree && !isCurrentUserPremium && !isChatWithSelf) {
        showCustomEmojiPremiumNotification();
        return;
      }
      const customEmojiMessage = parseMessageInput(buildCustomEmojiHtml(sticker));
      text = customEmojiMessage.text;
      entities = customEmojiMessage.entities;
    }

    sendMessage({ text, entities, isReaction: true });
    closeReactionPicker();
  });

  const handleReactionPickerOpen = useLastCallback((position: IAnchorPosition) => {
    openStoryReactionPicker({
      peerId: chatId,
      storyId: storyId!,
      position,
      sendAsMessage: true,
    });
  });

  const handleLikeStory = useLastCallback(() => {
    const reaction = sentStoryReaction ? undefined : HEART_REACTION;
    sendStoryReaction({
      peerId: chatId,
      storyId: storyId!,
      containerId: getStoryKey(chatId, storyId!),
      reaction,
    });
  });

  const handleSendScheduled = useLastCallback(() => {
    requestCalendar((scheduledAt) => {
      handleMessageSchedule({}, scheduledAt, currentMessageList!);
    });
  });

  const handleSendSilent = useLastCallback(() => {
    sendSilent();
  });

  const handleSendWhenOnline = useLastCallback(() => {
    handleMessageSchedule({}, SCHEDULED_WHEN_ONLINE, currentMessageList!);
  });

  const handleSendScheduledAttachments = useLastCallback((sendCompressed: boolean, sendGrouped: boolean) => {
    requestCalendar((scheduledAt) => {
      handleMessageSchedule({ sendCompressed, sendGrouped }, scheduledAt, currentMessageList!);
    });
  });

  const handleSendSilentAttachments = useLastCallback((sendCompressed: boolean, sendGrouped: boolean) => {
    sendSilent({ sendCompressed, sendGrouped });
  });

  const onSend = mainButtonState === MainButtonState.Edit
    ? handleEditComplete
    : mainButtonState === MainButtonState.Schedule ? handleSendScheduled
      : handleSend;

  const withBotCommands = isChatWithBot && botMenuButton?.type === 'commands' && !editingMessage
    && botCommands !== false && !activeVoiceRecording;

  return (
    <div className={fullClassName}>
      {isInMessageList && canAttachMedia && isReady && (
        <DropArea
          isOpen={dropAreaState !== DropAreaState.None}
          withQuick={dropAreaState === DropAreaState.QuickFile || prevDropAreaState === DropAreaState.QuickFile}
          onHide={onDropHide!}
          onFileSelect={handleFileSelect}
        />
      )}
      {shouldRenderReactionSelector && (
        <ReactionSelector
          topReactions={topReactions}
          allAvailableReactions={availableReactions}
          onToggleReaction={handleToggleReaction}
          isPrivate
          isReady={isReady}
          canBuyPremium={canBuyPremium}
          isCurrentUserPremium={isCurrentUserPremium}
          canPlayAnimatedEmojis={canPlayAnimatedEmojis}
          onShowMore={handleReactionPickerOpen}
          className={reactionSelectorTransitonClassNames}
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
        shouldForceCompression={shouldForceCompression}
        shouldForceAsFile={shouldForceAsFile}
        isForCurrentMessageList={isForCurrentMessageList}
        isForMessage={isInMessageList}
        shouldSchedule={shouldSchedule}
        forceDarkTheme={isInStoryViewer}
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
        getHtml={getHtml}
        onClick={handleBotCommandSelect}
        onClose={closeBotCommandTooltip}
      />
      <div className={buildClassName('composer-wrapper', isInStoryViewer && 'with-story-tweaks')}>
        <svg className="svg-appendix" width="9" height="20">
          <defs>
            <filter
              x="-50%"
              y="-14.7%"
              width="200%"
              height="141.2%"
              filterUnits="objectBoundingBox"
              id="composerAppendix"
            >
              <feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1" />
              <feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1" />
              <feColorMatrix
                values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0"
                in="shadowBlurOuter1"
              />
            </filter>
          </defs>
          <g fill="none" fill-rule="evenodd">
            <path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#000" filter="url(#composerAppendix)" />
            <path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#FFF" className="corner" />
          </g>
        </svg>
        {isInMessageList && (
          <>
            <InlineBotTooltip
              isOpen={isInlineBotTooltipOpen}
              botId={inlineBotId}
              isGallery={isInlineBotTooltipGallery}
              inlineBotResults={inlineBotResults}
              switchPm={inlineBotSwitchPm}
              switchWebview={inlineBotSwitchWebview}
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
          </>
        )}
        <div className="message-input-wrapper">
          {isInMessageList && (
            <>
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
                  <i className="icon icon-bot-commands-filled" />
                </ResponsiveHoverButton>
              )}
              {canShowSendAs && (sendAsUser || sendAsChat) && (
                <Button
                  round
                  color="translucent"
                  onClick={isSendAsMenuOpen ? closeSendAsMenu : handleSendAsMenuOpen}
                  ariaLabel={lang('SendMessageAsTitle')}
                  className={buildClassName(
                    'send-as-button',
                    shouldAnimateSendAsButtonRef.current && 'appear-animation',
                  )}
                >
                  <Avatar
                    peer={sendAsUser || sendAsChat}
                    size="tiny"
                  />
                </Button>
              )}
            </>
          )}
          {(!isComposerBlocked || canSendGifs || canSendStickers) && (
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
              isMessageComposer={isInMessageList}
              onGifSelect={handleGifSelect}
              onStickerSelect={handleStickerSelect}
              onCustomEmojiSelect={handleCustomEmojiSelect}
              onRemoveSymbol={removeSymbol}
              onEmojiSelect={insertTextAndUpdateCursor}
              closeBotCommandMenu={closeBotCommandMenu}
              closeSendAsMenu={closeSendAsMenu}
              isSymbolMenuForced={isSymbolMenuForced}
              canSendPlainText={!isComposerBlocked}
              inputCssSelector={editableInputCssSelector}
              idPrefix={type}
              forceDarkTheme={isInStoryViewer}
            />
          )}
          <MessageInput
            ref={inputRef}
            id={inputId}
            editableInputId={editableInputId}
            customEmojiPrefix={type}
            isStoryInput={isInStoryViewer}
            chatId={chatId}
            canSendPlainText={!isComposerBlocked}
            threadId={threadId}
            isReady={isReady}
            isActive={!hasAttachments}
            getHtml={getHtml}
            placeholder={
              activeVoiceRecording && windowWidth <= SCREEN_WIDTH_TO_HIDE_PLACEHOLDER
                ? ''
                : (!isComposerBlocked
                  ? (botKeyboardPlaceholder || inputPlaceholder || lang('Message'))
                  : lang('Chat.PlaceholderTextNotAllowed'))
            }
            timedPlaceholderDate={timedPlaceholderDate}
            timedPlaceholderLangKey={timedPlaceholderLangKey}
            forcedPlaceholder={inlineBotHelp}
            canAutoFocus={isReady && isForCurrentMessageList && !hasAttachments && isInMessageList}
            noFocusInterception={hasAttachments}
            shouldSuppressFocus={isMobile && isSymbolMenuOpen}
            shouldSuppressTextFormatter={isEmojiTooltipOpen || isMentionTooltipOpen || isInlineBotTooltipOpen}
            onUpdate={setHtml}
            onSend={onSend}
            onSuppressedFocus={closeSymbolMenu}
            onFocus={markInputHasFocus}
            onBlur={unmarkInputHasFocus}
          />
          {isInMessageList && (
            <>
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
                  <i className="icon icon-schedule" />
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
                  <i className="icon icon-bot-command" />
                </ResponsiveHoverButton>
              )}
            </>
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
            canSendPhotos={canSendPhotos}
            canSendVideos={canSendVideos}
            canSendDocuments={canSendDocuments}
            canSendAudios={canSendAudios}
            onFileSelect={handleFileSelect}
            onPollCreate={openPollModal}
            isScheduled={shouldSchedule}
            attachBots={isInMessageList ? attachBots : undefined}
            peerType={attachMenuPeerType}
            shouldCollectDebugLogs={shouldCollectDebugLogs}
            theme={theme}
            onMenuOpen={onAttachMenuOpen}
            onMenuClose={onAttachMenuClose}
          />
          {isInMessageList && Boolean(botKeyboardMessageId) && (
            <BotKeyboardMenu
              messageId={botKeyboardMessageId}
              isOpen={isBotKeyboardOpen}
              onClose={closeBotKeyboard}
            />
          )}
          {isInMessageList && botCommands && (
            <BotCommandMenu
              isOpen={isBotCommandMenuOpen}
              botCommands={botCommands}
              onClose={closeBotCommandMenu}
            />
          )}
          <CustomEmojiTooltip
            key={`custom-emoji-tooltip-${editableInputId}`}
            chatId={chatId}
            isOpen={isCustomEmojiTooltipOpen}
            onCustomEmojiSelect={insertCustomEmoji}
            addRecentCustomEmoji={addRecentCustomEmoji}
            onClose={closeCustomEmojiTooltip}
          />
          <StickerTooltip
            key={`sticker-tooltip-${editableInputId}`}
            chatId={chatId}
            threadId={threadId}
            isOpen={isStickerTooltipOpen}
            onStickerSelect={handleStickerSelect}
            onClose={closeStickerTooltip}
          />
          <EmojiTooltip
            key={`emoji-tooltip-${editableInputId}`}
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
          <i className="icon icon-delete" />
        </Button>
      )}
      {isInStoryViewer && !activeVoiceRecording && (
        <Button
          round
          className="story-reaction-button"
          color="secondary"
          onClick={handleLikeStory}
          onContextMenu={handleStoryPickerContextMenu}
          onMouseDown={handleBeforeStoryPickerContextMenu}
          ariaLabel={lang('AccDescrLike')}
          ref={storyReactionRef}
        >
          {sentStoryReaction && (
            <ReactionAnimatedEmoji
              key={'documentId' in sentStoryReaction ? sentStoryReaction.documentId : sentStoryReaction.emoticon}
              containerId={getStoryKey(chatId, storyId!)}
              reaction={sentStoryReaction}
              withEffectOnly={isSentStoryReactionHeart}
            />
          )}
          {(!sentStoryReaction || isSentStoryReactionHeart) && (
            <i
              className={buildClassName(
                'icon',
                'icon-heart',
                isSentStoryReactionHeart && 'story-reaction-heart',
              )}
              aria-hidden
            />
          )}
        </Button>
      )}
      <Button
        ref={mainButtonRef}
        round
        color="secondary"
        className={buildClassName(
          mainButtonState,
          'main-button',
          !isReady && 'not-ready',
          activeVoiceRecording && 'recording',
        )}
        disabled={areVoiceMessagesNotAllowed}
        allowDisabledClick
        noFastClick
        ariaLabel={lang(sendButtonAriaLabel)}
        onClick={mainButtonHandler}
        onContextMenu={
          mainButtonState === MainButtonState.Send && canShowCustomSendMenu ? handleContextMenu : undefined
        }
      >
        <i className="icon icon-send" />
        <i className="icon icon-microphone-alt" />
        {onForward && <i className="icon icon-forward" />}
        {isInMessageList && <i className="icon icon-schedule" />}
        {isInMessageList && <i className="icon icon-check" />}
      </Button>
      {canShowCustomSendMenu && (
        <CustomSendMenu
          isOpen={isCustomSendMenuOpen}
          canSchedule={isInMessageList}
          canScheduleUntilOnline={canScheduleUntilOnline}
          onSendSilent={!isChatWithSelf ? handleSendSilent : undefined}
          onSendSchedule={!shouldSchedule ? handleSendScheduled : undefined}
          onSendWhenOnline={handleSendWhenOnline}
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
    chatId, threadId, storyId, messageListType, isMobile, type,
  }): StateProps => {
    const chat = selectChat(global, chatId);
    const chatBot = chatId !== REPLIES_USER_ID ? selectBot(global, chatId) : undefined;
    const isChatWithBot = Boolean(chatBot);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isChatWithUser = isUserId(chatId);
    const chatBotFullInfo = isChatWithBot ? selectUserFullInfo(global, chatBot.id) : undefined;
    const chatFullInfo = !isChatWithUser ? selectChatFullInfo(global, chatId) : undefined;
    const messageWithActualBotKeyboard = (isChatWithBot || !isChatWithUser)
      && selectNewestMessageWithBotKeyboardButtons(global, chatId, threadId);
    const scheduledIds = selectScheduledIds(global, chatId, threadId);
    const {
      language, shouldSuggestStickers, shouldSuggestCustomEmoji, shouldUpdateStickerSetOrder,
    } = global.settings.byKey;
    const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
    const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;
    const botKeyboardMessageId = messageWithActualBotKeyboard ? messageWithActualBotKeyboard.id : undefined;
    const keyboardMessage = botKeyboardMessageId ? selectChatMessage(global, chatId, botKeyboardMessageId) : undefined;
    const { currentUserId } = global;
    const defaultSendAsId = chatFullInfo ? chatFullInfo?.sendAsId || currentUserId : undefined;
    const sendAsId = chat?.sendAsPeerIds && defaultSendAsId && (
      chat.sendAsPeerIds.some((peer) => peer.id === defaultSendAsId)
        ? defaultSendAsId
        : (chat?.adminRights?.anonymous ? chat?.id : undefined)
    );
    const sendAsUser = sendAsId ? selectUser(global, sendAsId) : undefined;
    const sendAsChat = !sendAsUser && sendAsId ? selectChat(global, sendAsId) : undefined;
    const requestedDraftText = selectRequestedDraftText(global, chatId);
    const requestedDraftFiles = selectRequestedDraftFiles(global, chatId);

    const tabState = selectTabState(global);
    const isStoryViewerOpen = Boolean(tabState.storyViewer.storyId);

    const currentMessageList = selectCurrentMessageList(global);
    const isForCurrentMessageList = chatId === currentMessageList?.chatId
      && threadId === currentMessageList?.threadId
      && messageListType === currentMessageList?.type
      && !isStoryViewerOpen;
    const user = selectUser(global, chatId);
    const canSendVoiceByPrivacy = (user && !selectUserFullInfo(global, user.id)?.noVoiceMessages) ?? true;
    const slowMode = chatFullInfo?.slowMode;
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    const editingDraft = messageListType === 'scheduled'
      ? selectEditingScheduledDraft(global, chatId)
      : selectEditingDraft(global, chatId, threadId);

    const replyingToId = selectReplyingToId(global, chatId, threadId);

    const story = storyId && selectPeerStory(global, chatId, storyId);
    const sentStoryReaction = story && 'sentReaction' in story ? story.sentReaction : undefined;

    return {
      availableReactions: type === 'story' ? global.availableReactions : undefined,
      topReactions: type === 'story' ? global.topReactions : undefined,
      isOnActiveTab: !tabState.isBlurred,
      editingMessage: selectEditingMessage(global, chatId, threadId, messageListType),
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
      groupChatMembers: chatFullInfo?.members,
      topInlineBotIds: global.topInlineBots?.userIds,
      currentUserId,
      contentToBeScheduled: tabState.contentToBeScheduled,
      shouldSuggestStickers,
      shouldSuggestCustomEmoji,
      shouldUpdateStickerSetOrder,
      recentEmojis: global.recentEmojis,
      baseEmojiKeywords: baseEmojiKeywords?.keywords,
      emojiKeywords: emojiKeywords?.keywords,
      inlineBots: tabState.inlineBots.byUsername,
      isInlineBotLoading: tabState.inlineBots.isLoading,
      chatBotCommands: chatFullInfo?.botCommands,
      botCommands: chatBotFullInfo ? (chatBotFullInfo.botInfo?.commands || false) : undefined,
      botMenuButton: chatBotFullInfo?.botInfo?.menuButton,
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
      isCurrentUserPremium,
      canSendVoiceByPrivacy,
      attachmentSettings: global.attachmentSettings,
      slowMode,
      currentMessageList,
      isReactionPickerOpen: selectIsReactionPickerOpen(global),
      canBuyPremium: !isCurrentUserPremium && !selectIsPremiumPurchaseBlocked(global),
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
      shouldCollectDebugLogs: global.settings.byKey.shouldCollectDebugLogs,
      sentStoryReaction,
      stealthMode: global.stories.stealthMode,
    };
  },
)(Composer));
