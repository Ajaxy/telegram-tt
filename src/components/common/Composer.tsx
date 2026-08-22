import type { TeactNode } from '../../lib/teact/teact';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiAttachment,
  ApiAttachMenuPeerType,
  ApiAvailableEffect,
  ApiAvailableReaction,
  ApiBotCommand,
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiBotMenuButton,
  ApiChat,
  ApiChatFullInfo,
  ApiDisallowedGifts,
  ApiDraft,
  ApiFormattedText,
  ApiInputRichMessage,
  ApiMessage,
  ApiMessageEntity,
  ApiNewMediaTodo,
  ApiPeer,
  ApiQuickReply,
  ApiReaction,
  ApiStealthMode,
  ApiSticker,
  ApiTopic,
  ApiUser,
  ApiVideo,
  ApiWebPage,
} from '../../api/types';
import type { GlobalState, TabState } from '../../global/types';
import type {
  EditingDraft,
  IAnchorPosition,
  InlineBotSettings,
  MessageList,
  MessageListType,
  ThemeKey,
  ThreadId,
} from '../../types';
import type { RichEditorTooltipsConfig } from './tooltips/types';
import { ApiMediaFormat, ApiMessageEntityTypes, MAIN_THREAD_ID } from '../../api/types';

import {
  BASE_EMOJI_KEYWORD_LANG,
  HEART_REACTION,
  MAX_UPLOAD_FILEPART_SIZE,
  MIN_ROUND_VIDEO_RECORDING_TIME,
  ONE_TIME_MEDIA_TTL_SECONDS,
  ROUND_VIDEO_RECORDING_SIZE,
  SCHEDULED_WHEN_ONLINE,
  SEND_MESSAGE_ACTION_INTERVAL,
  SERVICE_NOTIFICATIONS_USER_ID,
  STARS_CURRENCY_CODE,
  VIDEO_RECORDING_FILENAME,
} from '../../config';
import { requestMeasure, requestMutation, requestNextMutation } from '../../lib/fasterdom/fasterdom';
import {
  canEditMedia,
  getAllowedAttachmentOptions,
  getMainUsername,
  getMediaFilename,
  getMediaHash,
  getMessageDocumentPhoto,
  getMessagePhoto,
  getReactionKey,
  getStoryKey,
  isChatAdmin,
  isChatChannel,
  isChatPublic,
  isChatSuperGroup,
  isSameReaction,
  isSystemBot,
  isUserRightBanned,
} from '../../global/helpers';
import { getChatNotifySettings } from '../../global/helpers/notifications';
import { getPeerTitle } from '../../global/helpers/peers';
import { getRichMessageUsage } from '../../global/helpers/richMessage';
import { containsCustomEmoji, stripCustomEmoji } from '../../global/helpers/symbols';
import {
  selectBot,
  selectCanManageAutoDelete,
  selectCanPlayAnimatedEmojis,
  selectCanScheduleUntilOnline,
  selectChat,
  selectChatFullInfo,
  selectChatHistoryTtl,
  selectChatMessage,
  selectChatType,
  selectCurrentMessageList,
  selectCustomEmoji,
  selectEditingMessage,
  selectEphemeralMessage,
  selectIsChatWithSelf,
  selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
  selectIsInSelectMode,
  selectIsPremiumPurchaseBlocked,
  selectIsReactionPickerOpen,
  selectIsRightColumnShown,
  selectNewestMessageWithBotKeyboardButtons,
  selectNotifyDefaults,
  selectNotifyException,
  selectPeer,
  selectPeerPaidMessagesStars,
  selectPeerStory,
  selectPerformanceSettingsValue,
  selectRequestedDraft,
  selectRequestedDraftFiles,
  selectTabState,
  selectTheme,
  selectTopicFromMessage,
  selectUser,
  selectUserFullInfo,
  selectWebPage,
} from '../../global/selectors';
import { selectCurrentLimit } from '../../global/selectors/limits';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import {
  selectDraft,
  selectEditingDraft,
  selectEditingScheduledDraft,
  selectNoWebPage,
} from '../../global/selectors/threads';
import {
  IS_IOS, IS_VIDEO_RECORDING_SUPPORTED, IS_VOICE_RECORDING_SUPPORTED,
} from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { formatCountdown, formatMediaDuration } from '../../util/dates/oldDateFormat';
import { processDeepLink } from '../../util/deeplink';
import { tryParseDeepLink } from '../../util/deepLinkParser';
import calcTextLineHeightAndCount from '../../util/element/calcTextLineHeightAndCount';
import { isUserId } from '../../util/entities/ids';
import { fetchBlob } from '../../util/files';
import focusEditableElement from '../../util/focusEditableElement';
import { formatStarsAsIcon } from '../../util/localization/format';
import { fetch } from '../../util/mediaLoader';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { getServerTime } from '../../util/serverTime';
import stopEvent from '../../util/stopEvent';
import { getUtf8Length } from '../../util/textFormat';
import windowSize from '../../util/windowSize';
import applyIosAutoCapitalizationFix from '../middle/composer/helpers/applyIosAutoCapitalizationFix';
import buildAttachment, {
  buildGifAttachment,
  prepareAttachmentsToSend,
} from '../middle/composer/helpers/buildAttachment';
import { armSendCollapseReserve } from '../middle/helpers/messageListReserves';
import {
  buildRichMessageFromFormatted,
  getRichInputAsFormatted,
  isValidInputRichMessage,
} from '../ui/textInput/richText';
import renderText from './helpers/renderText';

import useInterval from '../../hooks/schedulers/useInterval';
import useTimeout from '../../hooks/schedulers/useTimeout';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useDerivedState from '../../hooks/useDerivedState';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useFlag from '../../hooks/useFlag';
import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePeerColor from '../../hooks/usePeerColor';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import useResizeObserver from '../../hooks/useResizeObserver';
import useSchedule from '../../hooks/useSchedule';
import useSendMessageAction from '../../hooks/useSendMessageAction';
import useShowTransition from '../../hooks/useShowTransition';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';
import { useStateRef } from '../../hooks/useStateRef';
import useSyncEffect from '../../hooks/useSyncEffect';
import useAttachmentModal from '../middle/composer/hooks/useAttachmentModal';
import useClipboardPaste from '../middle/composer/hooks/useClipboardPaste';
import useDraft from '../middle/composer/hooks/useDraft';
import useEditing from '../middle/composer/hooks/useEditing';
import useLoadLinkPreview from '../middle/composer/hooks/useLoadLinkPreview';
import usePaidMessageConfirmation from '../middle/composer/hooks/usePaidMessageConfirmation';
import useRichEditor from '../middle/composer/hooks/useRichEditor';
import useVideoRecording from '../middle/composer/hooks/useVideoRecording';
import useVoiceRecording from '../middle/composer/hooks/useVoiceRecording';

import AttachmentModal from '../middle/composer/AttachmentModal.async';
import AttachMenu from '../middle/composer/AttachMenu';
import BotCommandMenu from '../middle/composer/BotCommandMenu.async';
import BotKeyboardMenu from '../middle/composer/BotKeyboardMenu';
import BotMenuButton from '../middle/composer/BotMenuButton';
import ComposerEmbeddedMessage from '../middle/composer/ComposerEmbeddedMessage';
import CustomSendMenu from '../middle/composer/CustomSendMenu.async';
import DropArea, { DropAreaState } from '../middle/composer/DropArea.async';
import MessageInput from '../middle/composer/MessageInput.async';
import RecordModeMenu, { type RecordMode } from '../middle/composer/RecordModeMenu';
import RoundVideoRecorder from '../middle/composer/RoundVideoRecorder';
import SendAsMenu from '../middle/composer/SendAsMenu.async';
import SymbolMenuButton from '../middle/composer/SymbolMenuButton';
import ToDoListModal from '../middle/composer/ToDoListModal.async';
import VoiceRecordBar from '../middle/composer/VoiceRecordBar';
import WebPagePreview from '../middle/composer/WebPagePreview';
import MessageEffect from '../middle/message/MessageEffect';
import ReactionSelector from '../middle/message/reactions/ReactionSelector';
import Button from '../ui/Button';
import ResponsiveHoverButton from '../ui/ResponsiveHoverButton';
import Spinner from '../ui/Spinner';
import TextTimer from '../ui/TextTimer';
import Transition from '../ui/Transition';
import AnimatedCounter from './AnimatedCounter';
import Avatar from './Avatar';
import AutoDeleteOutlinedIcon from './icons/AutoDeleteOutlinedIcon';
import Icon from './icons/Icon';
import PaymentMessageConfirmDialog from './PaymentMessageConfirmDialog';
import ReactionAnimatedEmoji from './reactions/ReactionAnimatedEmoji';
import RemoveFormattingModal from './RemoveFormattingModal';
import { hasActiveRichEditorTooltip } from './tooltips/extensions/RichEditorTooltips';

import './Composer.scss';

type ComposerType = 'messageList' | 'story';

type OwnProps = {
  type: ComposerType;
  chatId: string;
  threadId: ThreadId;
  storyId?: number;
  messageListType: MessageListType;
  dropAreaState?: string;
  isReady: boolean;
  isMobile?: boolean;
  inputId: string;
  editableInputCssSelector: string;
  editableInputId: string;
  className?: string;
  inputPlaceholder?: TeactNode | string;
  onDropHide?: NoneToVoidFunction;
  onForward?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onBlur?: NoneToVoidFunction;
};

type StateProps = {
  isOnActiveTab: boolean;
  recordMode: RecordMode;
  editingMessage?: ApiMessage;
  chat?: ApiChat;
  user?: ApiUser;
  chatFullInfo?: ApiChatFullInfo;
  draft?: ApiDraft;
  replyToTopic?: ApiTopic;
  currentMessageList?: MessageList;
  isChatWithBot?: boolean;
  isChatWithSelf?: boolean;
  isChannel?: boolean;
  isForCurrentMessageList: boolean;
  isRightColumnShown?: boolean;
  isSelectModeActive?: boolean;
  isReactionPickerOpen?: boolean;
  shouldDisplayGiftsButton?: boolean;
  isForwarding?: boolean;
  isReplying?: boolean;
  hasSuggestedPost?: boolean;
  forwardedMessagesCount?: number;
  todoListModal: TabState['todoListModal'];
  aiMessageEditorPendingResult: TabState['aiMessageEditorPendingResult'];
  botKeyboardMessageId?: number;
  botKeyboardPlaceholder?: string;
  withScheduledButton?: boolean;
  autoDeletePeriod?: number;
  isInScheduledList?: boolean;
  canScheduleUntilOnline?: boolean;
  currentUserId?: string;
  currentUser?: ApiUser;
  recentEmojis: string[];
  contentToBeScheduled?: TabState['contentToBeScheduled'];
  shouldSuggestStickers?: boolean;
  shouldSuggestCustomEmoji?: boolean;
  baseEmojiKeywords?: Record<string, string[]>;
  emojiKeywords?: Record<string, string[]>;
  topInlineBotIds?: string[];
  topGuestBotIds?: string[];
  isInlineBotLoading: boolean;
  inlineBots?: Record<string, false | InlineBotSettings>;
  botCommands?: ApiBotCommand[] | false;
  botMenuButton?: ApiBotMenuButton;
  sendAsPeer?: ApiPeer;
  sendAsId?: string;
  editingDraft?: EditingDraft;
  requestedDraft?: ApiFormattedText;
  requestedDraftFiles?: File[];
  attachBots: GlobalState['attachMenu']['bots'];
  attachMenuPeerType?: ApiAttachMenuPeerType;
  theme: ThemeKey;
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
  canSendOneTimeMedia?: boolean;
  quickReplyMessages?: Record<number, ApiMessage>;
  quickReplies?: Record<number, ApiQuickReply>;
  canSendQuickReplies?: boolean;
  webPagePreview?: ApiWebPage;
  noWebPage?: boolean;
  isContactRequirePremium?: boolean;
  paidMessagesStars?: number;
  effect?: ApiAvailableEffect;
  effectReactions?: ApiReaction[];
  areEffectsSupported?: boolean;
  canPlayEffect?: boolean;
  shouldPlayEffect?: boolean;
  maxMessageLength: number;
  richMessageLengthLimit: number;
  richMessageMaxBlocks: number;
  richMessageMaxDepth: number;
  richMessageMaxMedia: number;
  richMessageMaxTableColumns: number;
  shouldPaidMessageAutoApprove?: boolean;
  isSilentPosting?: boolean;
  isPaymentMessageConfirmDialogOpen: boolean;
  starsBalance: number;
  isStarsBalanceModalOpen: boolean;
  disallowedGifts?: ApiDisallowedGifts;
  isAccountFrozen?: boolean;
  isAppConfigLoaded?: boolean;
  insertingPeerIdMention?: string;
  isRichInputExpanded?: boolean;
  mediaEditorMessage?: ApiMessage;
};

enum MainButtonState {
  Send = 'send',
  Record = 'record',
  Edit = 'edit',
  Schedule = 'schedule',
  Forward = 'forward',
  SendOneTime = 'sendOneTime',
}

type ScheduledMessageArgs = TabState['contentToBeScheduled'] | {
  id: string; queryId: string; isSilent?: boolean;
};

const VOICE_RECORDING_FILENAME = 'wonderful-voice-message.ogg';
const CAN_SWITCH_RECORD_MODE = IS_VOICE_RECORDING_SUPPORTED && IS_VIDEO_RECORDING_SUPPORTED;
// When voice recording is active, composer placeholder will hide to prevent overlapping
const SCREEN_WIDTH_TO_HIDE_PLACEHOLDER = 600; // px

const MOBILE_KEYBOARD_HIDE_DELAY_MS = 100;
const SELECT_MODE_TRANSITION_MS = 200;
const SENDING_ANIMATION_DURATION = 350;
const MOUNT_ANIMATION_DURATION = 430;
const PAID_STARS_CLOSE_DURATION = 300;
const APPROXIMATE_RICH_INPUT_FORMAT_OPTIONS = { isApproximate: true };

const Composer = ({
  type,
  isOnActiveTab,
  recordMode,
  dropAreaState,
  isInScheduledList,
  canScheduleUntilOnline,
  isReady,
  isMobile,
  editingMessage,
  chatId,
  threadId,
  storyId,
  currentMessageList,
  messageListType,
  draft,
  chat,
  chatFullInfo,
  user,
  replyToTopic,
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
  shouldDisplayGiftsButton,
  isForwarding,
  isReplying,
  hasSuggestedPost,
  forwardedMessagesCount,
  todoListModal,
  aiMessageEditorPendingResult,
  botKeyboardMessageId,
  botKeyboardPlaceholder,
  inputPlaceholder,
  withScheduledButton,
  autoDeletePeriod,
  topInlineBotIds,
  topGuestBotIds,
  currentUserId,
  currentUser,
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
  sendAsPeer,
  sendAsId,
  editingDraft,
  requestedDraft,
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
  canSendOneTimeMedia,
  quickReplyMessages,
  quickReplies,
  canSendQuickReplies,
  webPagePreview,
  noWebPage,
  isContactRequirePremium,
  paidMessagesStars,
  effect,
  effectReactions,
  areEffectsSupported,
  canPlayEffect,
  shouldPlayEffect,
  maxMessageLength,
  richMessageLengthLimit,
  richMessageMaxBlocks,
  richMessageMaxDepth,
  richMessageMaxMedia,
  richMessageMaxTableColumns,
  isSilentPosting,
  isPaymentMessageConfirmDialogOpen,
  starsBalance,
  isStarsBalanceModalOpen,
  disallowedGifts,
  isAccountFrozen,
  isAppConfigLoaded,
  insertingPeerIdMention,
  isRichInputExpanded,
  mediaEditorMessage,
  onDropHide,
  onFocus,
  onBlur,
  onForward,
}: OwnProps & StateProps) => {
  const {
    sendMessage,
    clearDraft,
    saveDraft,
    showDialog,
    openTodoListModal,
    closeTodoListModal,
    clearAiMessageEditorPendingResult,
    loadScheduledHistory,
    openThread,
    addRecentEmoji,
    sendInlineBotResult,
    loadSendAs,
    resetOpenChatWithDraft,
    callAttachBot,
    addRecentCustomEmoji,
    showNotification,
    showAllowedMessageTypesNotification,
    openStoryReactionPicker,
    openGiftModal,
    openAutoDeleteTimerModal,
    closeReactionPicker,
    sendStoryReaction,
    editMessage,
    updateAttachmentSettings,
    saveEffectInDraft,
    setReactionEffect,
    hideEffectInComposer,
    updateChatSilentPosting,
    updateInsertingPeerIdMention,
    updateDraftSuggestedPostInfo,
    updateShouldSaveAttachmentsCompression,
    applyDefaultAttachmentsCompression,
    setIsRichInputExpanded,
    setSettingOption,
    openPremiumModal,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();
  const richEditor = useRichEditor();

  const inputRef = useRef<HTMLDivElement>();
  const composerRef = useRef<HTMLDivElement>();
  const counterRef = useRef<HTMLSpanElement>();

  const storyReactionRef = useRef<HTMLButtonElement>();

  const [isMounted, setIsMounted] = useState(false);
  const lastMessageSendTimeSecondsRef = useRef<number>();
  const prevDropAreaState = usePreviousDeprecated(dropAreaState);
  const { width: windowWidth } = windowSize.get();
  const forceUpdate = useForceUpdate();

  const isInMessageList = type === 'messageList';
  const isRichInputExpansionActive = Boolean(isInMessageList && isRichInputExpanded);
  const isInStoryViewer = type === 'story';
  const sendAsPeerIds = isInMessageList ? chat?.sendAsPeerIds : undefined;
  const canShowSendAs = Boolean(sendAsPeerIds?.length);
  // Prevent Symbol Menu from closing when calendar is open
  const [isSymbolMenuForced, forceShowSymbolMenu, cancelForceShowSymbolMenu] = useFlag();
  const sendMessageAction = useSendMessageAction(chatId, threadId);
  const [isInputHasFocus, markInputHasFocus, unmarkInputHasFocus] = useFlag();
  const [isAttachMenuOpen, onAttachMenuOpen, onAttachMenuClose] = useFlag();
  const [
    isRemoveFormattingModalOpen,
    openRemoveFormattingModal,
    closeRemoveFormattingModal,
  ] = useFlag();
  const shouldFocusAfterFormattingRemovalRef = useRef(false);

  const canMediaBeReplaced = editingMessage && canEditMedia(editingMessage);

  const isMonoforum = chat?.isMonoforum;
  const { emojiSet, members: groupChatMembers, botCommands: chatBotCommands } = chatFullInfo || {};
  const chatEmojiSetId = emojiSet?.id;

  const isEphemeralReply = draft?.replyInfo?.type === 'ephemeral';
  const canSchedule = !paidMessagesStars && !isMonoforum && !isEphemeralReply;

  const isSentStoryReactionHeart = sentStoryReaction && isSameReaction(sentStoryReaction, HEART_REACTION);

  const customEmojiNotificationNumberRef = useRef(0);

  const [requestCalendar, calendar] = useSchedule(
    isInMessageList && canSchedule && canScheduleUntilOnline,
    cancelForceShowSymbolMenu,
  );
  const requestMessageSchedule = useLastCallback((callback: Parameters<typeof requestCalendar>[0]) => {
    if (isEphemeralReply) return;

    requestCalendar(callback);
  });

  useTimeout(() => {
    setIsMounted(true);
  }, MOUNT_ANIMATION_DURATION);

  useEffect(() => {
    if (isInMessageList) return;

    closeReactionPicker();
  }, [isInMessageList, storyId]);

  useEffect(() => {
    lastMessageSendTimeSecondsRef.current = undefined;
  }, [chatId]);

  useEffect(() => {
    if (isAppConfigLoaded && chatId && isReady && !isInStoryViewer && !isMonoforum) {
      loadScheduledHistory({ chatId });
    }
  }, [isReady, chatId, threadId, isInStoryViewer, isAppConfigLoaded, isMonoforum]);

  useEffect(() => {
    const isChannelWithProfiles = isChannel && chat?.areProfilesShown;
    const isChatWithSendAs = chat && isChatSuperGroup(chat)
      && Boolean(isChatPublic(chat) || chat.isLinkedInDiscussion || chat.hasGeo);
    if (!sendAsPeerIds && isReady && (isChatWithSendAs || isChannelWithProfiles)) {
      loadSendAs({ chatId });
    }
  }, [chat, chatId, isChannel, isReady, loadSendAs, sendAsPeerIds]);

  const shouldAnimateSendAsButtonRef = useRef(false);
  useSyncEffect(([prevChatId, prevSendAsPeerIds]) => {
    // We only animate send-as button if `sendAsPeerIds` was missing when opening the chat
    shouldAnimateSendAsButtonRef.current = Boolean(chatId === prevChatId && sendAsPeerIds && !prevSendAsPeerIds);
  }, [chatId, sendAsPeerIds]);

  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);
  const hasAttachments = Boolean(attachments.length);
  const richMessage = richEditor.value;
  const richMessageAsFormatted = richMessage ? getRichInputAsFormatted(richMessage) : undefined;
  const hasInputContent = richEditor.isReady ? !richEditor.isEmpty() : false;
  const isOverRegularMessageLimit = Boolean(
    richMessageAsFormatted
    && getUtf8Length(richMessageAsFormatted.text) > maxMessageLength,
  );
  const hasRichOnlyContent = Boolean(
    hasInputContent
    && (
      !richMessageAsFormatted
      || (isCurrentUserPremium && isOverRegularMessageLimit)
    ),
  );

  const expandRichInput = useLastCallback(() => {
    setIsRichInputExpanded({ isRichInputExpanded: true });
  });

  const collapseRichInput = useLastCallback(() => {
    setIsRichInputExpanded({ isRichInputExpanded: undefined });
  });

  const handleRichInputEscape = useLastCallback(() => {
    const editor = richEditor.editor;
    if (editor && hasActiveRichEditorTooltip(editor)) {
      return false;
    }

    collapseRichInput();
    return undefined;
  });

  const updateRichMessage = useLastCallback((value?: ApiInputRichMessage) => {
    if (value && !isCurrentUserPremium && !isChatWithSelf) {
      const formattedValue = getRichInputAsFormatted(value);
      if (formattedValue && containsCustomEmoji(formattedValue)) {
        showCustomEmojiPremiumNotification();
        richEditor.setValue(buildRichMessageFromFormatted(stripCustomEmoji(formattedValue)));
        return;
      }
    }

    richEditor.setValue(value);
  });

  const checkCanSendRichContent = useLastCallback(() => {
    if (!isInMessageList || isCurrentUserPremium) {
      return true;
    }

    const currentValue = richEditor.getValue();
    if (!currentValue.blocks.length || getRichInputAsFormatted(currentValue)) {
      return true;
    }

    const approximateValue = getRichInputAsFormatted(currentValue, APPROXIMATE_RICH_INPUT_FORMAT_OPTIONS);
    if (!isValidInputRichMessage(currentValue) || !approximateValue) {
      return true;
    }

    openRemoveFormattingModal();
    return false;
  });

  const handleCloseRemoveFormattingModal = useLastCallback(() => {
    shouldFocusAfterFormattingRemovalRef.current = false;
    closeRemoveFormattingModal();
  });

  const handleRemoveFormatting = useLastCallback(() => {
    const currentValue = richEditor.getValue();
    const formattedValue = getRichInputAsFormatted(
      currentValue,
      APPROXIMATE_RICH_INPUT_FORMAT_OPTIONS,
    )!;
    richEditor.replaceValue(buildRichMessageFromFormatted(formattedValue));
    shouldFocusAfterFormattingRemovalRef.current = true;
    closeRemoveFormattingModal();
  });

  const handleSubscribeToPremium = useLastCallback(() => {
    shouldFocusAfterFormattingRemovalRef.current = false;
    closeRemoveFormattingModal();
    openPremiumModal();
  });

  const handleRemoveFormattingModalCloseAnimationEnd = useLastCallback(() => {
    if (!shouldFocusAfterFormattingRemovalRef.current) {
      return;
    }

    shouldFocusAfterFormattingRemovalRef.current = false;
    richEditor.focus();
  });

  useEffect(() => {
    handleCloseRemoveFormattingModal();
  }, [chatId, threadId, isCurrentUserPremium, handleCloseRemoveFormattingModal]);

  useEffect(() => {
    if (!attachments.length || !attachments) {
      updateShouldSaveAttachmentsCompression({ shouldSave: false });
    }
  }, [attachments]);

  const {
    canSendStickers, canSendGifs, canAttachMedia, canAttachPolls, canAttachEmbedLinks, canAttachToDoLists,
    canSendVoices, canSendRoundVideos, canSendPlainText, canSendAudios, canSendVideos, canSendPhotos, canSendDocuments,
  } = useMemo(
    () => getAllowedAttachmentOptions(
      chat,
      chatFullInfo,
      isChatWithBot,
      isChatWithSelf,
      isInStoryViewer,
      paidMessagesStars,
      isInScheduledList,
      isEphemeralReply,
    ),
    [
      chat, chatFullInfo, isChatWithBot, isChatWithSelf, isInStoryViewer, paidMessagesStars, isInScheduledList,
      isEphemeralReply,
    ],
  );
  const canUseInlineBots = !chat || isChatAdmin(chat) || !isUserRightBanned(chat, 'sendInline', chatFullInfo);

  const isNeedPremium = isContactRequirePremium && isInStoryViewer;
  const isSendTextBlocked = isNeedPremium || (Boolean(chat) && !canSendPlainText);

  const messagesCount = useDerivedState(() => {
    if (hasAttachments) return attachments.length;
    const messagesInInput = hasInputContent ? 1 : 0;
    if (!isForwarding || !forwardedMessagesCount) return messagesInInput || 1;
    return forwardedMessagesCount + messagesInInput;
  }, [hasInputContent, hasAttachments, attachments, isForwarding, forwardedMessagesCount]);
  const starsForAllMessages = paidMessagesStars ? messagesCount * paidMessagesStars : 0;

  const {
    closeConfirmDialog: closeConfirmModalPayForMessage,
    dialogHandler: paymentMessageConfirmDialogHandler,
    shouldAutoApprove: shouldPaidMessageAutoApprove,
    setAutoApprove: setShouldPaidMessageAutoApprove,
    handleWithConfirmation: handleActionWithPaymentConfirmation,
  } = usePaidMessageConfirmation(starsForAllMessages, isStarsBalanceModalOpen, starsBalance);

  const isPaidSendDeferred = starsForAllMessages > 0 && !shouldPaidMessageAutoApprove;

  const hasWebPagePreview = !hasAttachments && canAttachEmbedLinks && !noWebPage
    && webPagePreview?.webpageType === 'full';
  const isComposerBlocked = isSendTextBlocked && !editingMessage;

  useEffect(() => {
    if (!hasWebPagePreview) {
      updateAttachmentSettings({ isInvertedMedia: undefined });
    }
  }, [hasWebPagePreview]);

  const insertTextAndUpdateCursor = useLastCallback((text: string) => {
    if (isComposerBlocked) return;

    richEditor.insertContent({ type: 'text', text });
  });

  const insertFormattedTextAndUpdateCursor = useLastCallback((
    text: ApiFormattedText, shouldPrepend = false,
  ) => {
    if (isComposerBlocked) return;

    if (!richEditor.isReady && shouldPrepend) {
      updateRichMessage(buildRichMessageFromFormatted(text));
      return;
    }

    if (!richEditor.isReady) {
      return;
    }

    richEditor.insertContent({ type: 'formattedText', text }, shouldPrepend);
  });

  const insertCustomEmojiAndUpdateCursor = useLastCallback((emoji: ApiSticker) => {
    if (isComposerBlocked) return;

    richEditor.insertContent({ type: 'customEmoji', emoji });
  });

  const {
    shouldForceCompression,
    shouldForceAsFile,
    handleAppendFiles,
    handleFileSelect,
    handleClearAttachments,
    handleSetAttachments,
  } = useAttachmentModal({
    attachments,
    setAttachments,
    fileSizeLimit,
    chatId,
    canAttachFiles: !hasRichOnlyContent,
    canSendAudios,
    canSendVideos,
    canSendPhotos,
    canSendDocuments,
    editedMessage: editingMessage,
    shouldSendInHighQuality: attachmentSettings.shouldSendInHighQuality,
  });

  const mediaEditRequestRef = useRef<number>();
  useEffect(() => {
    if (!mediaEditorMessage) return;
    const media = getMessagePhoto(mediaEditorMessage) || getMessageDocumentPhoto(mediaEditorMessage);
    if (!media) return;
    const mediaHash = getMediaHash(media, 'full');
    if (!mediaHash) return;
    const now = Date.now();
    mediaEditRequestRef.current = now;
    fetch(mediaHash, ApiMediaFormat.BlobUrl).then(async (blobUrl) => {
      if (mediaEditRequestRef.current !== now) return;
      const blob = await fetchBlob(blobUrl);
      const attachment = await buildAttachment(getMediaFilename(media), blob);
      handleSetAttachments([attachment]);
    });
  }, [mediaEditorMessage, handleSetAttachments]);

  const [isBotKeyboardOpen, openBotKeyboard, closeBotKeyboard] = useFlag();
  const [isBotCommandMenuOpen, openBotCommandMenu, closeBotCommandMenu] = useFlag();
  const [isSymbolMenuOpen, openSymbolMenu, closeSymbolMenu] = useFlag();
  const [isSendAsMenuOpen, openSendAsMenu, closeSendAsMenu] = useFlag();
  const [isHoverDisabled, disableHover, enableHover] = useFlag();

  const {
    startRecordingVoice,
    stopRecordingVoice,
    cancelRecordingVoice,
    pauseRecordingVoice,
    resumeRecordingVoice,
    toggleViewOnceEnabled,
    subscribeToRecordingPeaks,
    activeVoiceRecording,
    isRecordingPaused,
    recordButtonRef: mainButtonRef,
    isViewOnceEnabled,
    setIsViewOnceEnabled,
  } = useVoiceRecording();

  const {
    startRecordingVideo,
    stopRecordingVideo,
    finishRecordingVideo,
    discardRecordingVideo,
    pauseRecordingVideo,
    resumeRecordingVideo,
    activeVideoRecording,
    previewStream,
    isVideoRecordingStarting,
    isVideoRecordingReady,
    isVideoRecordingPaused,
    isRecordingFinished,
    getProgress,
    subscribeToVideoRecordingPeaks,
  } = useVideoRecording();

  const activeRecording = activeVoiceRecording || activeVideoRecording;
  const [isEmbeddedMessageOpen, setIsEmbeddedMessageOpen] = useState(false);

  useEffect(() => {
    if (!activeRecording) return;
    const input = document.getElementById(editableInputId);
    if (input && document.activeElement === input) {
      input.blur();
    }
  }, [activeRecording, editableInputId]);

  const shouldSendRecordingStatus = isForCurrentMessageList && !isInStoryViewer;
  useInterval(() => {
    sendMessageAction({ type: 'recordAudio' });
  }, shouldSendRecordingStatus ? activeVoiceRecording && SEND_MESSAGE_ACTION_INTERVAL : undefined);
  useInterval(() => {
    sendMessageAction({ type: 'recordRound' });
  }, shouldSendRecordingStatus ? activeVideoRecording && SEND_MESSAGE_ACTION_INTERVAL : undefined);

  useEffect(() => {
    if (!isForCurrentMessageList || isInStoryViewer) return;
    if (!activeVoiceRecording && !activeVideoRecording) {
      sendMessageAction({ type: 'cancel' });
    }
  }, [activeVoiceRecording, activeVideoRecording, isForCurrentMessageList, isInStoryViewer, sendMessageAction]);

  useEffect(() => {
    return () => {
      discardRecordingVideo();
    };
  }, [chatId, threadId, discardRecordingVideo]);

  const isEditingRef = useStateRef(Boolean(editingMessage));
  useEffect(() => {
    if (!isForCurrentMessageList || isInStoryViewer) return;
    if (hasInputContent && !isEditingRef.current) {
      sendMessageAction({ type: 'typing' });
    }
  }, [hasInputContent, isEditingRef, isForCurrentMessageList, isInStoryViewer, sendMessageAction]);

  const isAdmin = chat && isChatAdmin(chat);
  const [inlineBotHelp, setInlineBotHelp] = useState<string | undefined>();

  const insertMention = useLastCallback((peer: ApiPeer, forceFocus = false) => {
    const username = getMainUsername(peer);
    const text = username ? `@${username}` : getPeerTitle(lang, peer);
    if (!text) {
      return;
    }

    if (forceFocus) {
      richEditor.focus();
    }
    richEditor.insertContent([{
      type: 'mention',
      userId: peer.id,
      username,
      text,
    }, { type: 'text', text: ' ' }]);
  });

  useEffect(() => {
    if (!insertingPeerIdMention) return;
    const peer = selectPeer(getGlobal(), insertingPeerIdMention);
    if (peer) {
      insertMention(peer, true);
    }
    updateInsertingPeerIdMention({ peerId: undefined });
  }, [insertingPeerIdMention, insertMention]);

  useEffect(() => {
    if (!aiMessageEditorPendingResult) return;

    const { text, shouldClear, shouldSendWithAttachments } = aiMessageEditorPendingResult;

    if (shouldSendWithAttachments) return;

    if (shouldClear) {
      updateRichMessage(undefined);
      clearDraft({ chatId, threadId, isLocalOnly: true });
    } else if (text) {
      updateRichMessage(buildRichMessageFromFormatted(text));
      saveDraft({ chatId, threadId, text });
    }

    clearAiMessageEditorPendingResult();
  }, [aiMessageEditorPendingResult, chatId, clearDraft,
    clearAiMessageEditorPendingResult, saveDraft, threadId, updateRichMessage]);

  const hasQuickReplies = Boolean(quickReplies && Object.keys(quickReplies).length);

  useDraft({
    draft,
    chatId,
    threadId,
    richMessage,
    replaceRichMessage: updateRichMessage,
    editedMessage: editingMessage,
    isDisabled: isInStoryViewer || Boolean(requestedDraft) || (!hasSuggestedPost && isMonoforum),
  });

  useLoadLinkPreview({
    chatId,
    threadId,
    richMessage,
  });

  const resetComposer = useLastCallback((shouldPreserveInput = false, shouldSkipCollapseLatch = false) => {
    if (!shouldPreserveInput) {
      if (!shouldSkipCollapseLatch) {
        const footer = inputRef.current?.closest<HTMLElement>('.middle-column-footer');
        const scroller = footer?.parentElement?.querySelector<HTMLElement>(':scope > .MessageList');
        if (scroller) {
          armSendCollapseReserve(scroller);
        }
      }

      updateRichMessage(undefined);
    }

    setAttachments(MEMO_EMPTY_ARRAY);
    collapseRichInput();

    if (isMobile) {
      // @optimization
      setTimeout(() => closeSymbolMenu(), SENDING_ANIMATION_DURATION);
    } else {
      closeSymbolMenu();
    }
  });

  const validateTextLength = useLastCallback((text: string, isAttachmentModal?: boolean) => {
    const maxLength = isAttachmentModal ? captionLimit : maxMessageLength;
    const textLength = getUtf8Length(text);
    if (textLength > maxLength) {
      const extraLength = textLength - maxLength;
      showNotification({
        message: {
          key: 'ErrorMessageTooLong',
          variables: {
            count: extraLength,
          },
          options: {
            pluralValue: extraLength,
          },
        },
      });

      return false;
    }
    return true;
  });

  const validateRichMessageLimits = useLastCallback((value: ApiInputRichMessage) => {
    const usage = getRichMessageUsage(value);

    if (usage.textLength > richMessageLengthLimit) {
      const extraLength = usage.textLength - richMessageLengthLimit;
      showNotification({
        message: {
          key: 'ErrorMessageTooLong',
          variables: { count: extraLength },
          options: { pluralValue: extraLength },
        },
      });
      return false;
    }

    if (usage.blockCount > richMessageMaxBlocks) {
      const extraCount = usage.blockCount - richMessageMaxBlocks;
      showNotification({
        message: {
          key: 'ErrorRichMessageTooManyBlocks',
          variables: { count: extraCount },
          options: { pluralValue: extraCount },
        },
      });
      return false;
    }

    if (usage.maxDepth > richMessageMaxDepth) {
      showNotification({
        message: {
          key: 'ErrorRichMessageTooDeep',
          variables: { count: richMessageMaxDepth },
        },
      });
      return false;
    }

    if (usage.mediaCount > richMessageMaxMedia) {
      const extraCount = usage.mediaCount - richMessageMaxMedia;
      showNotification({
        message: {
          key: 'ErrorRichMessageTooManyMedia',
          variables: { count: extraCount },
          options: { pluralValue: extraCount },
        },
      });
      return false;
    }

    if (usage.maxTableColumnCount > richMessageMaxTableColumns) {
      showNotification({
        message: {
          key: 'ErrorRichMessageTableTooWide',
          variables: { count: richMessageMaxTableColumns },
        },
      });
      return false;
    }

    return true;
  });

  const [handleEditComplete, handleEditCancel, shouldForceShowEditing] = useEditing(
    richMessage,
    updateRichMessage,
    editingMessage,
    resetComposer,
    validateTextLength,
    chatId,
    threadId,
    messageListType,
    draft,
    editingDraft,
  );

  // Handle chat change (should be placed after `useDraft` and `useEditing`)
  const resetComposerRef = useStateRef(resetComposer);
  const cancelRecordingVoiceRef = useStateRef(cancelRecordingVoice);
  useLayoutEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
      cancelRecordingVoiceRef.current();
      // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
      resetComposerRef.current(false, true);
    };
  }, [chatId, threadId, resetComposerRef, cancelRecordingVoiceRef]);

  const areAllGiftsDisallowed = useMemo(() => {
    if (!disallowedGifts) {
      return undefined;
    }
    return Object.values(disallowedGifts).every(Boolean);
  }, [disallowedGifts]);

  const shouldShowGiftButton = Boolean(!isChatWithSelf && shouldDisplayGiftsButton && !areAllGiftsDisallowed);
  const shouldShowSuggestedPostButton = isMonoforum && !editingMessage
    && !isForwarding && !isReplying && !draft?.suggestedPostInfo;

  const showCustomEmojiPremiumNotification = useLastCallback(() => {
    const notificationNumber = customEmojiNotificationNumberRef.current;
    if (!notificationNumber) {
      showNotification({
        message: oldLang('UnlockPremiumEmojiHint'),
        action: {
          action: 'openPremiumModal',
          payload: { initialSection: 'animated_emoji' },
        },
        actionText: oldLang('PremiumMore'),
      });
    } else {
      showNotification({
        message: oldLang('UnlockPremiumEmojiHint2'),
        action: {
          action: 'openChat',
          payload: { id: currentUserId, shouldReplaceHistory: true },
        },
        actionText: oldLang('Open'),
      });
    }
    customEmojiNotificationNumberRef.current = Number(!notificationNumber);
  });

  const isStoryReactionPickerOpen = isInStoryViewer && Boolean(isReactionPickerOpen);
  const isComposerEngaged = isInputHasFocus || isSymbolMenuOpen || isSymbolMenuForced || isBotKeyboardOpen
    || isSendAsMenuOpen || isStoryReactionPickerOpen || Boolean(activeRecording) || attachments.length > 0;
  const isComposerActive = isComposerEngaged || isAttachMenuOpen;

  const mainButtonState = useDerivedState(() => {
    if (!isComposerEngaged && onForward && !(hasInputContent && !hasAttachments)) {
      return MainButtonState.Forward;
    }

    if (editingMessage && shouldForceShowEditing) {
      return MainButtonState.Edit;
    }

    if ((IS_VOICE_RECORDING_SUPPORTED || IS_VIDEO_RECORDING_SUPPORTED)
      && !activeVoiceRecording && !activeVideoRecording && !isForwarding && !isRichInputExpansionActive
      && !(hasInputContent && !hasAttachments)) {
      return MainButtonState.Record;
    }

    if (isInScheduledList) {
      return MainButtonState.Schedule;
    }

    return MainButtonState.Send;
  }, [
    activeVoiceRecording, activeVideoRecording, editingMessage, hasAttachments, isForwarding, isComposerEngaged,
    onForward, shouldForceShowEditing, isInScheduledList, hasInputContent, isRichInputExpansionActive,
  ]);
  const canShowCustomSendMenu = !isInScheduledList;

  const {
    isContextMenuOpen: isCustomSendMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(mainButtonRef, !(mainButtonState === MainButtonState.Send && canShowCustomSendMenu));

  const canSwitchRecordMode = CAN_SWITCH_RECORD_MODE
    && canSendVoiceByPrivacy && canSendVoices && canSendRoundVideos;

  const {
    isContextMenuOpen: isRecordModeMenuOpen,
    handleContextMenu: handleRecordModeContextMenu,
    handleContextMenuClose: handleRecordModeMenuClose,
    handleContextMenuHide: handleRecordModeMenuHide,
  } = useContextMenuHandlers(
    mainButtonRef, !(mainButtonState === MainButtonState.Record && canSwitchRecordMode),
  );

  const handleSelectRecordMode = useLastCallback((mode: RecordMode) => {
    setSettingOption({ lastRecordMessageMode: mode });
    handleRecordModeMenuClose();
  });

  const {
    contextMenuAnchor: storyReactionPickerAnchor,
    handleContextMenu: handleStoryPickerContextMenu,
    handleBeforeContextMenu: handleBeforeStoryPickerContextMenu,
    handleContextMenuHide: handleStoryPickerContextMenuHide,
  } = useContextMenuHandlers(storyReactionRef, !isInStoryViewer);

  useEffect(() => {
    if (isReactionPickerOpen) return;

    if (storyReactionPickerAnchor) {
      openStoryReactionPicker({
        peerId: chatId,
        storyId: storyId!,
        position: storyReactionPickerAnchor,
      });
      handleStoryPickerContextMenuHide();
    }
  }, [chatId, handleStoryPickerContextMenuHide, isReactionPickerOpen, storyId, storyReactionPickerAnchor]);

  const { className: peerColorClass, style: peerColorStyle } = usePeerColor({
    peer: sendAsPeer || currentUser,
    theme,
  });

  const hasGifFromPicker = attachments.some((a) => a.gif);

  const resolveFilePasteTarget = useLastCallback(() => {
    const currentRichMessage = richEditor.getValue();
    const hasUnrepresentableRichContent = Boolean(
      currentRichMessage.blocks.length && !getRichInputAsFormatted(currentRichMessage),
    );

    return hasUnrepresentableRichContent ? 'none' : 'attachmentModal';
  });

  useClipboardPaste(
    isForCurrentMessageList || isInStoryViewer,
    insertFormattedTextAndUpdateCursor,
    handleSetAttachments,
    editingMessage,
    resolveFilePasteTarget,
    !attachments.length,
    hasGifFromPicker,
  );

  const handleEmbeddedClear = useLastCallback(() => {
    if (editingMessage) {
      handleEditCancel();
    }
  });

  const checkSlowMode = useLastCallback(() => {
    if (slowMode && !isAdmin) {
      const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);

      const nowSeconds = getServerTime();
      const secondsSinceLastMessage = lastMessageSendTimeSecondsRef.current
        && Math.floor(nowSeconds - lastMessageSendTimeSecondsRef.current);
      const nextSendDateNotReached = slowMode.nextSendDate && slowMode.nextSendDate > nowSeconds;

      if (
        (secondsSinceLastMessage !== undefined && secondsSinceLastMessage < slowMode.seconds)
        || nextSendDateNotReached
      ) {
        const secondsRemaining = nextSendDateNotReached
          ? slowMode.nextSendDate! - nowSeconds
          : slowMode.seconds - secondsSinceLastMessage!;

        showDialog({
          data: {
            type: 'localized',
            text: {
              key: 'SlowModeHint',
              variables: {
                time: formatMediaDuration(secondsRemaining),
              },
            },
          },
        });

        messageInput?.blur();

        return false;
      }
    }
    return true;
  });

  const validateEphemeralReply = useLastCallback(() => {
    if (
      draft?.replyInfo?.type === 'ephemeral'
      && !selectEphemeralMessage(getGlobal(), chatId, draft.replyInfo.replyToMsgId)
    ) {
      showNotification({ message: { key: 'EphemeralReplyUnavailable' } });
      return false;
    }

    return true;
  });

  const canSendAttachments = (attachmentsToSend: ApiAttachment[]): boolean => {
    if (!currentMessageList && !storyId) {
      return false;
    }

    const currentRichMessage = richEditor.getValue();
    const formattedRichMessage = currentRichMessage.blocks.length
      ? getRichInputAsFormatted(currentRichMessage) : undefined;
    if (currentRichMessage.blocks.length && !formattedRichMessage) {
      return false;
    }

    const { text } = formattedRichMessage || { text: '' };
    if (!text && !attachmentsToSend.length) {
      return false;
    }
    if (!validateTextLength(text, true)) return false;
    if (!checkSlowMode()) return false;

    return true;
  };

  const sendAttachments = useLastCallback(({
    attachments: attachmentsToSend,
    sendCompressed = attachmentSettings.shouldCompress,
    sendGrouped = attachmentSettings.shouldSendGrouped,
    isSilent,
    scheduledAt,
    scheduleRepeatPeriod,
    isInvertedMedia,
  }: {
    attachments: ApiAttachment[];
    sendCompressed?: boolean;
    sendGrouped?: boolean;
    isSilent?: boolean;
    scheduledAt?: number;
    scheduleRepeatPeriod?: number;
    isInvertedMedia?: true;
  }) => {
    if (!validateEphemeralReply()) return;

    if (!currentMessageList && !storyId) {
      return;
    }
    isSilent = isSilent || isSilentPosting;

    const currentRichMessage = richEditor.getValue();
    const formattedRichMessage = currentRichMessage.blocks.length
      ? getRichInputAsFormatted(currentRichMessage) : undefined;
    const { text, entities } = formattedRichMessage || { text: '' };

    isInvertedMedia = text && sendCompressed && sendGrouped ? isInvertedMedia : undefined;

    if (editingMessage) {
      editMessage({
        messageList: currentMessageList,
        text,
        entities,
        attachments: prepareAttachmentsToSend(attachmentsToSend, sendCompressed),
      });
    } else {
      sendMessage({
        messageList: currentMessageList,
        text,
        entities,
        scheduledAt,
        scheduleRepeatPeriod,
        isSilent,
        shouldUpdateStickerSetOrder,
        attachments: prepareAttachmentsToSend(attachmentsToSend, sendCompressed),
        shouldGroupMessages: sendGrouped,
        isInvertedMedia,
      });
    }

    lastMessageSendTimeSecondsRef.current = getServerTime();

    clearDraft({ chatId, threadId, isLocalOnly: true });

    const shouldSkipCollapseLatch = Boolean(editingMessage) || Boolean(scheduledAt && !isInScheduledList);

    // Wait until message animation starts
    requestMeasure(() => {
      resetComposer(false, shouldSkipCollapseLatch);
    });
  });

  const handleSendAttachmentsFromModal = useLastCallback((
    sendCompressed: boolean,
    sendGrouped: boolean,
    isInvertedMedia?: true,
  ) => {
    if (canSendAttachments(attachments)) {
      if (editingMessage) {
        sendAttachments({
          attachments,
          sendCompressed,
          sendGrouped,
          isInvertedMedia,
        });
        return;
      }

      handleActionWithPaymentConfirmation(sendAttachments, {
        attachments,
        sendCompressed,
        sendGrouped,
        isInvertedMedia,
      });
    }
  });

  const handleSendAttachments = useLastCallback((
    sendCompressed: boolean,
    sendGrouped: boolean,
    isSilent?: boolean,
    scheduledAt?: number,
    isInvertedMedia?: true,
    scheduleRepeatPeriod?: number,
  ) => {
    if (canSendAttachments(attachments)) {
      sendAttachments({
        attachments,
        sendCompressed,
        sendGrouped,
        isSilent,
        scheduledAt,
        scheduleRepeatPeriod,
        isInvertedMedia,
      });
    }
  });

  const handleSendCore = useLastCallback(
    (
      currentAttachments: ApiAttachment[],
      isSilent = false,
      scheduledAt?: number,
      scheduleRepeatPeriod?: number,
    ) => {
      const richEditorValue = richEditor.getValue();
      const currentRichMessage = richEditorValue.blocks.length ? richEditorValue : undefined;
      const formattedRichMessage = currentRichMessage ? getRichInputAsFormatted(currentRichMessage) : undefined;
      const richMessageToSend = hasRichOnlyContent ? currentRichMessage : undefined;
      const { text, entities } = richMessageToSend
        ? { text: '' }
        : formattedRichMessage || { text: '' };

      if (currentAttachments.length) {
        if (canSendAttachments(currentAttachments)) {
          sendAttachments({
            attachments: currentAttachments,
            scheduledAt,
            scheduleRepeatPeriod,
            isSilent,
          });
        }
        return;
      }

      if (richMessageToSend) {
        if (
          !currentMessageList
          || !isValidInputRichMessage(richMessageToSend)
          || !validateRichMessageLimits(richMessageToSend)
        ) {
          return;
        }
        if (!checkSlowMode()) return;

        const effectId = effect?.id;
        if (areEffectsSupported) saveEffectInDraft({ chatId, threadId, effectId: undefined });

        if (editingMessage) {
          editMessage({
            messageList: currentMessageList,
            text: '',
            richMessage: richMessageToSend,
          });
        } else {
          sendMessage({
            messageList: currentMessageList,
            richMessage: richMessageToSend,
            scheduledAt,
            scheduleRepeatPeriod,
            isSilent,
            shouldUpdateStickerSetOrder,
            effectId,
          });
        }

        lastMessageSendTimeSecondsRef.current = getServerTime();
        clearDraft({
          chatId, threadId, isLocalOnly: true, shouldKeepReply: isForwarding,
        });

        const shouldSkipCollapseLatch = Boolean(editingMessage) || Boolean(scheduledAt && !isInScheduledList);

        requestMeasure(() => {
          resetComposer(false, shouldSkipCollapseLatch);
        });
        return;
      }

      if (!text && !isForwarding) {
        return;
      }

      if (!validateTextLength(text)) return;

      const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);

      const effectId = effect?.id;

      if (text || isForwarding) {
        if (!checkSlowMode()) return;

        const isInvertedMedia = hasWebPagePreview ? attachmentSettings.isInvertedMedia : undefined;

        if (areEffectsSupported) saveEffectInDraft({ chatId, threadId, effectId: undefined });

        sendMessage({
          messageList: currentMessageList,
          text,
          entities,
          scheduledAt,
          scheduleRepeatPeriod,
          isSilent,
          shouldUpdateStickerSetOrder,
          isInvertedMedia,
          effectId,
          webPageMediaSize: attachmentSettings.webPageMediaSize,
          webPageUrl: hasWebPagePreview ? webPagePreview.url : undefined,
        });
      }

      lastMessageSendTimeSecondsRef.current = getServerTime();
      clearDraft({
        chatId, threadId, isLocalOnly: true, shouldKeepReply: isForwarding,
      });

      if (IS_IOS && messageInput && messageInput === document.activeElement) {
        applyIosAutoCapitalizationFix(messageInput);
      }

      // Wait until message animation starts
      requestMeasure(() => {
        resetComposer(false, Boolean(scheduledAt && !isInScheduledList));
      });
    },
  );

  const handleSend = useLastCallback(async (
    isSilent = false,
    scheduledAt?: number,
    scheduleRepeatPeriod?: number,
  ) => {
    if (!validateEphemeralReply()) return;

    if (!currentMessageList && !storyId) {
      return;
    }

    isSilent = isSilent || isSilentPosting;

    let currentAttachments = attachments;

    if (activeVoiceRecording) {
      const record = await stopRecordingVoice();
      const ttlSeconds = isViewOnceEnabled ? ONE_TIME_MEDIA_TTL_SECONDS : undefined;
      if (record) {
        const { blob, duration, waveform } = record;
        currentAttachments = [await buildAttachment(
          VOICE_RECORDING_FILENAME,
          blob,
          { voice: { duration, waveform }, ttlSeconds },
        )];
      }
    }

    if (activeVideoRecording) {
      const record = await stopRecordingVideo();
      const ttlSeconds = isViewOnceEnabled ? ONE_TIME_MEDIA_TTL_SECONDS : undefined;
      if (record && record.durationMs >= MIN_ROUND_VIDEO_RECORDING_TIME) {
        const { blob, duration } = record;
        currentAttachments = [await buildAttachment(
          VIDEO_RECORDING_FILENAME,
          blob,
          {
            isRoundVideo: true,
            ttlSeconds,
            quick: { width: ROUND_VIDEO_RECORDING_SIZE, height: ROUND_VIDEO_RECORDING_SIZE, duration },
          },
        )];
      }
    }

    handleSendCore(currentAttachments, isSilent, scheduledAt, scheduleRepeatPeriod);
  });

  const handleSendWithConfirmation = useLastCallback((
    isSilent = false,
    scheduledAt?: number,
    scheduleRepeatPeriod?: number,
  ) => {
    if (!checkCanSendRichContent()) {
      return;
    }

    handleActionWithPaymentConfirmation(handleSend, isSilent, scheduledAt, scheduleRepeatPeriod);
  });

  const handleTodoListCreate = useLastCallback(() => {
    if (!isCurrentUserPremium) {
      showNotification({
        message: lang('SubscribeToTelegramPremiumForCreateToDo'),
        action: {
          action: 'openPremiumModal',
          payload: { initialSection: 'todo' },
        },
        actionText: lang('PremiumMore'),
      });
      return;
    }

    openTodoListModal({ chatId });
  });

  const handleOpenRichInput = useLastCallback(() => {
    if (!isInMessageList) {
      return;
    }

    closeSymbolMenu();
    expandRichInput();
  });

  const handleClickBotMenu = useLastCallback(() => {
    if (botMenuButton?.type !== 'webApp') {
      return;
    }

    const parsedLink = tryParseDeepLink(botMenuButton.url);

    if (parsedLink?.type === 'publicUsernameOrBotLink' && parsedLink.appName) {
      processDeepLink(botMenuButton.url);
    } else {
      callAttachBot({
        chatId, url: botMenuButton.url, threadId,
      });
    }
  });

  const handleActivateBotCommandMenu = useLastCallback(() => {
    closeSymbolMenu();
    openBotCommandMenu();
  });

  const handleMessageSchedule = useLastCallback((
    args: ScheduledMessageArgs,
    scheduledAt: number,
    scheduleRepeatPeriod: number | undefined,
    messageList: MessageList,
    effectId?: string,
  ) => {
    if (!validateEphemeralReply() || isEphemeralReply) return;

    if (args && 'queryId' in args) {
      const { id, queryId, isSilent } = args;
      sendInlineBotResult({
        id,
        chatId,
        threadId,
        queryId,
        scheduledAt,
        isSilent: isSilent || isSilentPosting,
      });
      return;
    }

    const { isSilent, ...restArgs } = args || {};

    if (!args || Object.keys(restArgs).length === 0) {
      void handleSend(Boolean(isSilent), scheduledAt, scheduleRepeatPeriod);
    } else if (args.sendCompressed !== undefined || args.sendGrouped !== undefined) {
      const { sendCompressed = false, sendGrouped = false, isInvertedMedia } = args;
      void handleSendAttachments(sendCompressed, sendGrouped, isSilent, scheduledAt, isInvertedMedia,
        scheduleRepeatPeriod);
    } else {
      sendMessage({
        ...args,
        messageList,
        scheduledAt,
        scheduleRepeatPeriod,
        effectId,
      });
    }
  });

  useEffectWithPrevDeps(([prevContentToBeScheduled]) => {
    if (currentMessageList && contentToBeScheduled && contentToBeScheduled !== prevContentToBeScheduled) {
      requestMessageSchedule((scheduledAt, scheduleRepeatPeriod) => {
        handleMessageSchedule(contentToBeScheduled, scheduledAt, scheduleRepeatPeriod, currentMessageList, undefined);
      });
    }
  }, [contentToBeScheduled, currentMessageList, handleMessageSchedule, requestMessageSchedule]);

  useEffect(() => {
    if (requestedDraft) {
      updateRichMessage(undefined);
      insertFormattedTextAndUpdateCursor(requestedDraft, true);
      resetOpenChatWithDraft();

      requestNextMutation(() => {
        const messageInput = document.getElementById(editableInputId)!;
        focusEditableElement(messageInput, true);
      });
    }
  }, [editableInputId, insertFormattedTextAndUpdateCursor, requestedDraft, resetOpenChatWithDraft, updateRichMessage]);

  useEffect(() => {
    if (requestedDraftFiles?.length) {
      void handleFileSelect(requestedDraftFiles);
      resetOpenChatWithDraft();
    }
  }, [handleFileSelect, requestedDraftFiles, resetOpenChatWithDraft]);

  useEffect(() => {
    if (requestedDraftFiles?.length) {
      updateShouldSaveAttachmentsCompression({ shouldSave: true });
      applyDefaultAttachmentsCompression();
    } else {
      updateShouldSaveAttachmentsCompression({ shouldSave: false });
    }
  }, [requestedDraftFiles, updateShouldSaveAttachmentsCompression, applyDefaultAttachmentsCompression]);

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    const emojiSetId = 'id' in emoji.stickerSetInfo && emoji.stickerSetInfo.id;
    if (!emoji.isFree && !isCurrentUserPremium && !isChatWithSelf && emojiSetId !== chatEmojiSetId) {
      showCustomEmojiPremiumNotification();
      return;
    }

    insertCustomEmojiAndUpdateCursor(emoji);
  });

  const handleGifSelect = useLastCallback((gif: ApiVideo, isSilent?: boolean, isScheduleRequested?: boolean) => {
    if (!validateEphemeralReply() || (isEphemeralReply && isScheduleRequested)) return;

    if (!currentMessageList && !storyId) {
      return;
    }

    isSilent = isSilent || isSilentPosting;

    if (isInScheduledList || isScheduleRequested) {
      forceShowSymbolMenu();
      requestMessageSchedule((scheduledAt, scheduleRepeatPeriod) => {
        cancelForceShowSymbolMenu();
        handleActionWithPaymentConfirmation(
          handleMessageSchedule,
          { gif, isSilent },
          scheduledAt,
          scheduleRepeatPeriod,
          currentMessageList!,
        );
        requestMeasure(() => {
          resetComposer(true);
        });
      });
    } else {
      handleActionWithPaymentConfirmation(sendMessage, { messageList: currentMessageList, gif, isSilent });
      requestMeasure(() => {
        resetComposer(true);
      });
    }

    clearDraft({ chatId, threadId, isLocalOnly: true });
  });

  const handleGifAddCaption = useLastCallback((gif: ApiVideo) => {
    handleSetAttachments([buildGifAttachment(gif)]);
    closeSymbolMenu();
  });

  const handleStickerSelect = useLastCallback((
    sticker: ApiSticker,
    isSilent?: boolean,
    isScheduleRequested?: boolean,
    shouldPreserveInput = false,
    canUpdateStickerSetsOrder?: boolean,
  ) => {
    if (!validateEphemeralReply() || (isEphemeralReply && isScheduleRequested)) return;

    if (!currentMessageList && !storyId) {
      return;
    }

    isSilent = isSilent || isSilentPosting;

    if (isInScheduledList || isScheduleRequested) {
      forceShowSymbolMenu();
      requestMessageSchedule((scheduledAt, scheduleRepeatPeriod) => {
        cancelForceShowSymbolMenu();
        handleActionWithPaymentConfirmation(
          handleMessageSchedule,
          { sticker, isSilent },
          scheduledAt,
          scheduleRepeatPeriod,
          currentMessageList!,
        );
        requestMeasure(() => {
          resetComposer(shouldPreserveInput, !isInScheduledList || isPaidSendDeferred);
        });
      });
    } else {
      handleActionWithPaymentConfirmation(
        sendMessage,
        {
          messageList: currentMessageList,
          sticker,
          isSilent,
          shouldUpdateStickerSetOrder: shouldUpdateStickerSetOrder && canUpdateStickerSetsOrder,
        },
      );
      clearDraft({ chatId, threadId, isLocalOnly: true });

      requestMeasure(() => {
        resetComposer(shouldPreserveInput, isPaidSendDeferred);
      });
    }
  });

  const handleInlineBotSelect = useLastCallback((
    inlineBotId: string,
    inlineResult: ApiBotInlineResult | ApiBotInlineMediaResult, isSilent?: boolean, isScheduleRequested?: boolean,
  ) => {
    if (!validateEphemeralReply() || isEphemeralReply) return;

    if (!currentMessageList && !storyId) {
      return;
    }

    isSilent = isSilent || isSilentPosting;

    if (isInScheduledList || isScheduleRequested) {
      requestMessageSchedule((scheduledAt, scheduleRepeatPeriod) => {
        handleActionWithPaymentConfirmation(
          handleMessageSchedule,
          {
            id: inlineResult.id,
            queryId: inlineResult.queryId,
            isSilent,
          },
          scheduledAt,
          scheduleRepeatPeriod,
          currentMessageList!,
        );
      });
    } else {
      handleActionWithPaymentConfirmation(
        sendInlineBotResult,
        {
          id: inlineResult.id,
          queryId: inlineResult.queryId,
          threadId,
          chatId,
          isSilent,
        },
      );
    }

    const messageInput = document.querySelector<HTMLDivElement>(editableInputCssSelector);
    if (IS_IOS && messageInput && messageInput === document.activeElement) {
      applyIosAutoCapitalizationFix(messageInput);
    }

    clearDraft({ chatId, threadId, isLocalOnly: true });
    requestMeasure(() => {
      resetComposer(false, Boolean(isScheduleRequested && !isInScheduledList) || isPaidSendDeferred);
    });
  });

  const handleBotCommandSelect = useLastCallback(() => {
    clearDraft({ chatId, threadId, isLocalOnly: true });
    requestMeasure(() => {
      resetComposer();
    });
  });

  const getTooltipBoundary = useLastCallback(() => composerRef.current);
  const getRichEditorTooltipContext = useLastCallback(() => ({
    chatId,
    threadId,
    currentUserId,
    currentUser,
    groupChatMembers,
    topInlineBotIds: canUseInlineBots ? topInlineBotIds : undefined,
    topGuestBotIds,
    recentEmojiIds: recentEmojis,
    baseEmojiKeywords,
    emojiKeywords,
    inlineBots,
    botCommands,
    chatBotCommands,
    quickReplies: canSendQuickReplies && isCurrentUserPremium ? quickReplies : undefined,
    quickReplyMessages,
    isSavedMessages: isChatWithSelf,
    isInScheduledList,
    isCurrentUserPremium,
    canSendGifs,
  }));
  const getIsEmojiTooltipEnabled = useLastCallback(() => Boolean(
    isReady && isOnActiveTab && (isInStoryViewer || isForCurrentMessageList)
    && shouldSuggestStickers && !hasAttachments,
  ));
  const getIsCustomEmojiTooltipEnabled = useLastCallback(() => Boolean(
    isReady && isOnActiveTab && (isInStoryViewer || isForCurrentMessageList)
    && shouldSuggestCustomEmoji && !hasAttachments,
  ));
  const getIsStickerTooltipEnabled = useLastCallback(() => Boolean(
    isReady && isOnActiveTab && (isInStoryViewer || isForCurrentMessageList)
    && shouldSuggestStickers && canSendStickers && !hasAttachments,
  ));
  const getIsMentionTooltipEnabled = useLastCallback(() => Boolean(
    isInMessageList && isReady && isForCurrentMessageList && !hasAttachments,
  ));
  const getIsInlineBotTooltipEnabled = useLastCallback(() => Boolean(
    canUseInlineBots && isInMessageList && isReady && isForCurrentMessageList && !hasAttachments,
  ));
  const getIsCommandTooltipEnabled = useLastCallback(() => Boolean(
    isInMessageList
    && isReady
    && isForCurrentMessageList
    && (
      (botCommands && botCommands.length)
      || chatBotCommands?.length
      || (hasQuickReplies && canSendQuickReplies && isCurrentUserPremium)
    ),
  ));
  const getIsFormatterEnabled = useLastCallback(() => Boolean(
    isReady && isOnActiveTab && (isInStoryViewer || isForCurrentMessageList) && !hasAttachments,
  ));
  const richEditorTooltips = useMemo<RichEditorTooltipsConfig>(() => ({
    emoji: {
      isEnabled: getIsEmojiTooltipEnabled,
      addRecentEmoji,
      addRecentCustomEmoji,
    },
    customEmoji: {
      isEnabled: getIsCustomEmojiTooltipEnabled,
      addRecentCustomEmoji,
    },
    sticker: {
      isEnabled: getIsStickerTooltipEnabled,
      onSelect: handleStickerSelect,
    },
    mention: isInMessageList ? { isEnabled: getIsMentionTooltipEnabled } : undefined,
    command: isInMessageList ? {
      isEnabled: getIsCommandTooltipEnabled,
      onSelect: handleBotCommandSelect,
    } : undefined,
    inlineBot: isInMessageList ? {
      isEnabled: getIsInlineBotTooltipEnabled,
      onSelect: handleInlineBotSelect,
      onHelpChange: setInlineBotHelp,
    } : undefined,
    formatter: {
      isEnabled: getIsFormatterEnabled,
      capabilities: 'full',
    },
    getTooltipBoundary,
    getContext: getRichEditorTooltipContext,
  }), [
    addRecentCustomEmoji, addRecentEmoji, getIsCommandTooltipEnabled, getIsCustomEmojiTooltipEnabled,
    getIsEmojiTooltipEnabled, getIsFormatterEnabled, getIsInlineBotTooltipEnabled,
    getIsMentionTooltipEnabled, getIsStickerTooltipEnabled, getRichEditorTooltipContext,
    getTooltipBoundary, handleBotCommandSelect, handleInlineBotSelect, handleStickerSelect,
    isInMessageList, setInlineBotHelp,
  ]);

  const handleToDoListSend = useLastCallback((todo: ApiNewMediaTodo) => {
    if (!validateEphemeralReply()) return;

    if (!currentMessageList) {
      return;
    }

    if (isInScheduledList) {
      requestMessageSchedule((scheduledAt, scheduleRepeatPeriod) => {
        handleActionWithPaymentConfirmation(
          handleMessageSchedule,
          { todo },
          scheduledAt,
          scheduleRepeatPeriod,
          currentMessageList,
        );
      });
    } else {
      handleActionWithPaymentConfirmation(
        sendMessage,
        { messageList: currentMessageList, todo, isSilent: isSilentPosting },
      );
    }
  });

  const sendSilent = useLastCallback((additionalArgs?: ScheduledMessageArgs) => {
    if (isInScheduledList) {
      requestMessageSchedule((scheduledAt, scheduleRepeatPeriod) => {
        handleMessageSchedule(
          { ...additionalArgs, isSilent: true },
          scheduledAt,
          scheduleRepeatPeriod,
          currentMessageList!,
        );
      });
    } else if (additionalArgs && ('sendCompressed' in additionalArgs || 'sendGrouped' in additionalArgs)) {
      const { sendCompressed = false, sendGrouped = false, isInvertedMedia } = additionalArgs;
      void handleSendAttachments(sendCompressed, sendGrouped, true, undefined, isInvertedMedia);
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

    updateRichMessage(undefined);
  }, [attachments, isComposerBlocked, updateRichMessage]);

  const handleFormattedDateInsert = useLastCallback((text: ApiFormattedText) => {
    insertFormattedTextAndUpdateCursor(text);
  });

  const removeSymbol = useLastCallback(() => {
    richEditor.deleteCharacterBeforeSelection();
  });

  const handleAllScheduledClick = useLastCallback(() => {
    openThread({
      chatId, threadId, type: 'scheduled', noForumTopicPanel: true,
    });
  });

  const handleGiftClick = useLastCallback(() => {
    openGiftModal({ forUserId: chatId });
  });

  const handleAutoDeleteClick = useLastCallback(() => {
    openAutoDeleteTimerModal({ chatId });
  });
  const handleSuggestPostClick = useLastCallback(() => {
    updateDraftSuggestedPostInfo({
      price: { currency: STARS_CURRENCY_CODE, amount: 0, nanos: 0 },
    });
  });

  const handleToggleSilentPosting = useLastCallback(() => {
    const newValue = !isSilentPosting;
    updateChatSilentPosting({ chatId, isEnabled: newValue });

    showNotification({
      localId: 'silentPosting',
      icon: newValue ? 'mute' : 'unmute',
      message: lang(`ComposerSilentPosting${newValue ? 'Enabled' : 'Disabled'}Tootlip`),
    });
  });

  useEffect(() => {
    if (isRightColumnShown && isMobile) {
      closeSymbolMenu();
    }
  }, [isRightColumnShown, closeSymbolMenu, isMobile]);

  useEffect(() => {
    if (!isReady) return undefined;

    let timeout: number | undefined;
    if (isSelectModeActive) {
      disableHover();
    } else {
      timeout = window.setTimeout(() => {
        enableHover();
      }, SELECT_MODE_TRANSITION_MS);
    }
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isSelectModeActive, enableHover, disableHover, isReady]);

  const [shouldShowRichInputButton, setShouldShowRichInputButton] = useState(false);

  const updateShouldShowRichInputButton = useLastCallback(() => {
    if (hasAttachments) {
      setShouldShowRichInputButton(false);
      return;
    }

    requestMeasure(() => {
      const input = inputRef.current;
      if (!input || (!hasInputContent && !input.textContent)) {
        setShouldShowRichInputButton(false);
        return;
      }
      const { totalLines } = calcTextLineHeightAndCount(input, true);
      setShouldShowRichInputButton(totalLines >= 3);
    });
  });

  useEffect(() => {
    updateShouldShowRichInputButton();
  }, [richMessage, hasAttachments, hasInputContent]);
  useResizeObserver(inputRef, updateShouldShowRichInputButton, hasAttachments);

  const withBotMenuButton = isChatWithBot && botMenuButton?.type === 'webApp' && !editingMessage
    && messageListType === 'thread';
  const isBotMenuButtonOpen = withBotMenuButton && !hasInputContent && !activeRecording;

  const isComposerHasFocus = isComposerActive
    || isBotCommandMenuOpen || isBotMenuButtonOpen || isCustomSendMenuOpen;
  const isReactionSelectorOpen = isComposerHasFocus && !isReactionPickerOpen && isInStoryViewer && !isAttachMenuOpen
    && !isSymbolMenuOpen && !activeRecording && !hasInputContent;

  useEffect(() => {
    if (!isRichInputExpansionActive) {
      return undefined;
    }

    function handleDocumentMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | undefined;
      if (!target) {
        return;
      }

      if (
        target.closest('.message-input-wrapper')
        || target.closest('.main-button')
        || target.closest('[data-text-formatter]')
        || target.closest('.Menu')
        || target.closest('.Modal')
        || target.closest('[aria-modal="true"]')
        || target.closest('.symbol-menu')
        || target.closest('.composer-tooltip')
      ) {
        return;
      }

      collapseRichInput();
    }

    const releaseEscKeyListener = captureEscKeyListener(handleRichInputEscape);
    document.addEventListener('mousedown', handleDocumentMouseDown);

    return () => {
      releaseEscKeyListener();
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [handleRichInputEscape, isRichInputExpansionActive]);

  const slowModePlaceholder = (() => {
    if (!slowMode?.nextSendDate || slowMode.nextSendDate < getServerTime()) return undefined;

    return lang('SlowModePlaceholder', {
      timer: <TextTimer endsAt={slowMode.nextSendDate} onEnd={forceUpdate} />,
    }, { withNodes: true });
  })();

  const placeholder = useMemo(() => {
    if (activeRecording && windowWidth <= SCREEN_WIDTH_TO_HIDE_PLACEHOLDER) {
      return '';
    }

    if (!isComposerBlocked) {
      if (slowModePlaceholder) return slowModePlaceholder;
      if (botKeyboardPlaceholder) return botKeyboardPlaceholder;
      if (inputPlaceholder) return inputPlaceholder;
      if (paidMessagesStars) {
        return lang('ComposerPlaceholderPaidMessage', {
          amount: formatStarsAsIcon(lang, paidMessagesStars, { asFont: true, className: 'placeholder-star-icon' }),
        }, {
          withNodes: true,
        });
      }

      if (isReplying && hasSuggestedPost) {
        return lang('ComposerPlaceholderCaption');
      }

      if (stealthMode?.activeUntil && isInStoryViewer && stealthMode.activeUntil > getServerTime()) {
        return lang('StealthModeComposerPlaceholder', {
          timer: <TextTimer endsAt={stealthMode.activeUntil} onEnd={forceUpdate} />,
        }, { withNodes: true });
      }

      if (chat?.adminRights?.anonymous) {
        return lang('ComposerPlaceholderAnonymous');
      }

      if (chat?.isBotForum && !user?.canManageBotForumTopics && threadId === MAIN_THREAD_ID) {
        return lang('ComposerPlaceholderBotTopicGeneral');
      }

      if (chat?.isForum && !chat.isBotForum && chat.isForumAsMessages && threadId === MAIN_THREAD_ID) {
        return replyToTopic
          ? lang('ComposerPlaceholderTopic', { topic: replyToTopic.title })
          : lang('ComposerPlaceholderTopicGeneral');
      }
      if (isChannel) {
        return lang(isSilentPosting ? 'ComposerPlaceholderBroadcastSilent' : 'ComposerPlaceholderBroadcast');
      }
      return lang('ComposerPlaceholder');
    }

    if (isInStoryViewer) return lang('ComposerStoryPlaceholderLocked');

    return lang('ComposerPlaceholderNoText');
  }, [
    activeRecording, botKeyboardPlaceholder, chat, inputPlaceholder, isChannel, isComposerBlocked,
    isInStoryViewer, isSilentPosting, lang, replyToTopic, isReplying, threadId, windowWidth, paidMessagesStars,
    hasSuggestedPost, slowModePlaceholder, stealthMode?.activeUntil, user?.canManageBotForumTopics,
  ]);

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
  } = useShowTransitionDeprecated(isReactionSelectorOpen);
  const shouldForceVoiceMode = IS_VOICE_RECORDING_SUPPORTED && !canSendRoundVideos && canSendVoices;
  const shouldForceVideoMode = IS_VIDEO_RECORDING_SUPPORTED && !canSendVoices && canSendRoundVideos;
  const isRecordingVideoMode = IS_VIDEO_RECORDING_SUPPORTED
    && (recordMode === 'video' || !IS_VOICE_RECORDING_SUPPORTED || shouldForceVideoMode)
    && !shouldForceVoiceMode;
  const areRecordingsNotAllowed = mainButtonState === MainButtonState.Record
    && (!canAttachMedia || !canSendVoiceByPrivacy
      || (isRecordingVideoMode ? !canSendRoundVideos : !canSendVoices));

  const mainButtonHandler = useLastCallback(() => {
    switch (mainButtonState) {
      case MainButtonState.Forward:
        onForward?.();
        break;
      case MainButtonState.Send:
        handleSendWithConfirmation();
        break;
      case MainButtonState.Record: {
        if (areRecordingsNotAllowed) {
          if (!canSendVoiceByPrivacy) {
            showNotification({
              message: isRecordingVideoMode
                ? {
                  key: 'VideoMessagesRestrictedByPrivacy',
                  variables: { user: chat?.title ?? '' },
                  options: { withNodes: true, withMarkdown: true },
                }
                : oldLang('VoiceMessagesRestrictedByPrivacy', chat?.title),
            });
          } else if (isRecordingVideoMode ? !canSendRoundVideos : !canSendVoices) {
            showAllowedMessageTypesNotification({ chatId, messageListType });
          }
        } else {
          setIsViewOnceEnabled(false);
          if (isRecordingVideoMode) {
            void startRecordingVideo();
          } else {
            void startRecordingVoice();
          }
        }
        break;
      }
      case MainButtonState.Edit:
        if (hasRichOnlyContent) {
          handleSendWithConfirmation();
        } else {
          handleEditComplete();
        }
        break;
      case MainButtonState.Schedule:
        if (!checkCanSendRichContent()) {
          break;
        }
        if (activeVoiceRecording) {
          pauseRecordingVoice();
        }
        if (activeVideoRecording) {
          finishRecordingVideo();
        }
        if (!currentMessageList) {
          return;
        }
        requestMessageSchedule((scheduledAt, scheduleRepeatPeriod) => {
          handleMessageSchedule({}, scheduledAt, scheduleRepeatPeriod, currentMessageList, effect?.id);
        });
        break;
      default:
        break;
    }
  });

  let mainButtonContextMenuHandler: typeof handleContextMenu | undefined;
  if (mainButtonState === MainButtonState.Send && canShowCustomSendMenu) {
    mainButtonContextMenuHandler = handleContextMenu;
  } else if (mainButtonState === MainButtonState.Record) {
    mainButtonContextMenuHandler = canSwitchRecordMode ? handleRecordModeContextMenu : stopEvent;
  }

  let sendButtonAriaLabel = 'SendMessage';
  switch (mainButtonState) {
    case MainButtonState.Forward:
      sendButtonAriaLabel = 'Forward';
      break;
    case MainButtonState.Edit:
      sendButtonAriaLabel = 'Save edited message';
      break;
    case MainButtonState.Record:
      if (!canAttachMedia) {
        sendButtonAriaLabel = 'Conversation.DefaultRestrictedMedia';
      } else {
        sendButtonAriaLabel = isRecordingVideoMode ? 'AccDescrVideoMessage' : 'AccDescrVoiceMessage';
      }
  }

  const fullClassName = buildClassName(
    'Composer',
    isInMessageList && 'is-chat-composer',
    isInStoryViewer && 'is-story-composer',
    isInStoryViewer && isComposerEngaged && 'is-story-composer-focused',
    !isSelectModeActive && 'shown',
    isHoverDisabled && 'hover-disabled',
    isMounted && 'mounted',
    isEmbeddedMessageOpen && 'with-embedded',
    className,
  );
  const handleToggleReaction = useLastCallback((reaction: ApiReaction) => {
    let text: string | undefined;
    let entities: ApiMessageEntity[] | undefined;

    if (reaction.type === 'emoji') {
      text = reaction.emoticon;
    }

    if (reaction.type === 'custom') {
      const sticker = selectCustomEmoji(getGlobal(), reaction.documentId);
      if (!sticker) {
        return;
      }

      if (!sticker.isFree && !isCurrentUserPremium && !isChatWithSelf) {
        showCustomEmojiPremiumNotification();
        return;
      }
      text = sticker.emoji || '';
      entities = text ? [{
        type: ApiMessageEntityTypes.CustomEmoji,
        offset: 0,
        length: text.length,
        documentId: sticker.id,
      }] : undefined;
    }

    handleActionWithPaymentConfirmation(sendMessage, { text, entities, isReaction: true });
    closeReactionPicker();
  });

  const handleToggleEffectReaction = useLastCallback((reaction: ApiReaction) => {
    setReactionEffect({ chatId, threadId, reaction });

    closeReactionPicker();
  });

  const handleReactionPickerOpen = useLastCallback((position: IAnchorPosition) => {
    if (isMobile) {
      document.querySelector<HTMLDivElement>(editableInputCssSelector)?.blur();
    }

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
    if (!checkCanSendRichContent()) {
      return;
    }

    requestMessageSchedule((scheduledAt, scheduleRepeatPeriod) => {
      handleMessageSchedule({}, scheduledAt, scheduleRepeatPeriod, currentMessageList!, undefined);
    });
  });

  const handleSendSilent = useLastCallback(() => {
    if (!checkCanSendRichContent()) {
      return;
    }

    handleActionWithPaymentConfirmation(sendSilent);
  });

  const sendWhenOnline = useLastCallback(() => {
    handleActionWithPaymentConfirmation(
      handleMessageSchedule, {}, SCHEDULED_WHEN_ONLINE, undefined, currentMessageList!, effect?.id,
    );
  });

  const handleSendWhenOnline = useLastCallback(() => {
    if (!checkCanSendRichContent()) {
      return;
    }

    sendWhenOnline();
  });

  const handleSendScheduledAttachments = useLastCallback(
    (
      sendCompressed: boolean, sendGrouped: boolean, isInvertedMedia?: true,
      scheduledAt?: number, scheduleRepeatPeriod?: number,
    ) => {
      if (scheduledAt) {
        handleActionWithPaymentConfirmation(
          handleMessageSchedule,
          { sendCompressed, sendGrouped, isInvertedMedia },
          scheduledAt,
          scheduleRepeatPeriod,
          currentMessageList!,
          undefined,
        );
      } else {
        requestMessageSchedule((calendarScheduledAt, calendarRepeatPeriod) => {
          handleActionWithPaymentConfirmation(
            handleMessageSchedule,
            { sendCompressed, sendGrouped, isInvertedMedia },
            calendarScheduledAt,
            calendarRepeatPeriod,
            currentMessageList!,
            undefined,
          );
        });
      }
    },
  );

  const handleSendSilentAttachments = useLastCallback(
    (sendCompressed: boolean, sendGrouped: boolean, isInvertedMedia?: true) => {
      handleActionWithPaymentConfirmation(sendSilent, { sendCompressed, sendGrouped, isInvertedMedia });
    },
  );

  const handleRemoveEffect = useLastCallback(() => {
    saveEffectInDraft({ chatId, threadId, effectId: undefined });
  });

  const handleStopEffect = useLastCallback(() => {
    hideEffectInComposer({});
  });

  const onSend = useMemo(() => {
    switch (mainButtonState) {
      case MainButtonState.Edit:
        return hasRichOnlyContent ? handleSendWithConfirmation : handleEditComplete;
      case MainButtonState.Schedule:
        return handleSendScheduled;
      default:
        return handleSendWithConfirmation;
    }
  }, [mainButtonState, hasRichOnlyContent, handleEditComplete, handleSendWithConfirmation]);

  const withBotCommands = isChatWithBot && botMenuButton?.type === 'commands' && !editingMessage
    && botCommands !== false && !activeRecording;

  const effectEmoji = areEffectsSupported && effect?.emoticon;

  const canOpenRichInput = shouldShowRichInputButton && isInMessageList && !hasAttachments && !isRichInputExpanded
    && !isComposerBlocked;
  const canCloseRichInput = Boolean(isRichInputExpansionActive && !isComposerBlocked);
  const canToggleRichInput = canOpenRichInput || canCloseRichInput;
  const {
    ref: voiceRecordBarRef, shouldRender: shouldRenderVoiceRecordBar,
  } = useShowTransition<HTMLDivElement>({
    isOpen: Boolean(activeRecording),
    withShouldRender: true,
  });
  const renderedRecording = useCurrentOrPrev(activeRecording);

  const {
    ref: roundVideoRecorderRef, shouldRender: shouldRenderRoundVideoRecorder,
  } = useShowTransition<HTMLDivElement>({
    isOpen: isVideoRecordingStarting || Boolean(activeVideoRecording && previewStream),
    withShouldRender: true,
    className: false,
  });
  const renderedVideoRecording = useCurrentOrPrev(activeVideoRecording);
  const renderedPreviewStream = useCurrentOrPrev(previewStream);

  const isPaidSend = Boolean(paidMessagesStars && mainButtonState === MainButtonState.Send);
  const { ref: paidStarsRef, shouldRender: shouldRenderPaidStars } = useShowTransition({
    isOpen: isPaidSend,
    withShouldRender: true,
    className: 'slow',
    closeDuration: PAID_STARS_CLOSE_DURATION,
  });

  useEffect(() => {
    const starsEl = paidStarsRef.current;
    const buttonEl = mainButtonRef.current;
    if (!starsEl || !buttonEl) return;

    requestMeasure(() => {
      const width = starsEl.scrollWidth + 1;
      requestMutation(() => {
        buttonEl.style.setProperty('--paid-stars-width', `${width}px`);
      });
    });
  }, [shouldRenderPaidStars, starsForAllMessages, paidStarsRef, mainButtonRef]);

  return (
    <div ref={composerRef} className={fullClassName}>
      {isInMessageList && canAttachMedia && !hasRichOnlyContent && isReady && (
        <DropArea
          isOpen={dropAreaState !== DropAreaState.None}
          withQuick={dropAreaState === DropAreaState.QuickFile || prevDropAreaState === DropAreaState.QuickFile}
          onHide={onDropHide!}
          onFileSelect={handleFileSelect}
          editingMessage={editingMessage}
        />
      )}
      {shouldRenderReactionSelector && !isNeedPremium && (
        <ReactionSelector
          topReactions={topReactions}
          allAvailableReactions={availableReactions}
          onToggleReaction={handleToggleReaction}
          isPrivate
          isReady={isReady}
          canBuyPremium={canBuyPremium}
          isCurrentUserPremium={isCurrentUserPremium}
          isInSavedMessages={isChatWithSelf}
          isInStoryViewer={isInStoryViewer}
          canPlayAnimatedEmojis={canPlayAnimatedEmojis}
          onShowMore={handleReactionPickerOpen}
          className={reactionSelectorTransitonClassNames}
        />
      )}
      <AttachmentModal
        chatId={chatId}
        threadId={threadId}
        richEditor={richEditor}
        canShowCustomSendMenu={canShowCustomSendMenu}
        attachments={attachments}
        isReady={isReady}
        shouldForceCompression={shouldForceCompression}
        shouldForceAsFile={shouldForceAsFile}
        isForCurrentMessageList={isForCurrentMessageList}
        isForMessage={isInMessageList}
        shouldSchedule={canSchedule && isInScheduledList}
        canSchedule={canSchedule}
        forceDarkTheme={isInStoryViewer}
        onSendSilent={handleSendSilentAttachments}
        onSend={handleSendAttachmentsFromModal}
        onSendScheduled={handleSendScheduledAttachments}
        onFileAppend={handleAppendFiles}
        onClear={handleClearAttachments}
        onAttachmentsUpdate={handleSetAttachments}
        editingMessage={editingMessage}
        onSendWhenOnline={sendWhenOnline}
        canScheduleUntilOnline={canSchedule && canScheduleUntilOnline && !isViewOnceEnabled}
        paidMessagesStars={paidMessagesStars}
      />
      <ToDoListModal
        modal={todoListModal}
        onClear={closeTodoListModal}
        onSend={handleToDoListSend}
      />
      <SendAsMenu
        isOpen={isSendAsMenuOpen}
        onClose={closeSendAsMenu}
        chatId={chatId}
        selectedSendAsId={sendAsId}
        sendAsPeerIds={sendAsPeerIds}
        isCurrentUserPremium={isCurrentUserPremium}
      />
      {isInMessageList && (
        <>
          <ComposerEmbeddedMessage
            onClear={handleEmbeddedClear}
            onIsOpenChange={setIsEmbeddedMessageOpen}
            shouldForceShowEditing={Boolean(shouldForceShowEditing && editingMessage)}
            isHidden={isRichInputExpansionActive}
            chatId={chatId}
            threadId={threadId}
            messageListType={messageListType}
          />
          {!isRichInputExpansionActive && (
            <WebPagePreview
              chatId={chatId}
              threadId={threadId}
              isDisabled={!canAttachEmbedLinks || hasAttachments || hasRichOnlyContent || !hasInputContent}
              isEditing={Boolean(editingMessage)}
            />
          )}
        </>
      )}
      <div
        className={buildClassName(
          'composer-wrapper',
          isRichInputExpansionActive && 'rich-input-expanded',
        )}
      >
        <div
          className={buildClassName(
            'message-input-wrapper',
            peerColorClass,
            activeRecording && 'is-voice-recording',
          )}
          style={peerColorStyle}
        >
          {isInMessageList && !isRichInputExpansionActive && (
            <>
              {withBotMenuButton && (
                <BotMenuButton
                  isOpen={isBotMenuButtonOpen}
                  text={botMenuButton.text}
                  isDisabled={Boolean(activeRecording)}
                  onClick={handleClickBotMenu}
                />
              )}
              {withBotCommands && (
                <ResponsiveHoverButton
                  className={buildClassName(
                    'bot-commands', 'composer-action-button', isBotCommandMenuOpen && 'activated',
                  )}
                  round
                  disabled={botCommands === undefined}
                  color="translucent"
                  onActivate={handleActivateBotCommandMenu}
                  ariaLabel="Open bot command keyboard"
                >
                  <Icon name="menu" />
                </ResponsiveHoverButton>
              )}
              {canShowSendAs && sendAsPeer && (
                <Button
                  round
                  color="translucent"
                  onClick={isSendAsMenuOpen ? closeSendAsMenu : handleSendAsMenuOpen}
                  ariaLabel={oldLang('SendMessageAsTitle')}
                  className={buildClassName(
                    'send-as-button',
                    'composer-action-button',
                    shouldAnimateSendAsButtonRef.current && 'appear-animation',
                  )}
                >
                  <Avatar
                    peer={sendAsPeer}
                    size="tiny"
                  />
                </Button>
              )}
            </>
          )}
          {!isNeedPremium && (
            <AttachMenu
              chatId={chatId}
              threadId={threadId}
              editingMessage={editingMessage}
              canEditMedia={canMediaBeReplaced}
              isButtonVisible={!activeRecording}
              canAttachMedia={canAttachMedia}
              canAttachFiles={!hasRichOnlyContent}
              canAttachPolls={canAttachPolls}
              canAttachToDoLists={canAttachToDoLists}
              canSendPhotos={canSendPhotos}
              canSendVideos={canSendVideos}
              canSendDocuments={canSendDocuments}
              canSendAudios={canSendAudios}
              canInsertDate={!isComposerBlocked}
              onFileSelect={handleFileSelect}
              onDateInsert={handleFormattedDateInsert}
              onTodoListCreate={handleTodoListCreate}
              isScheduled={isInScheduledList}
              attachBots={isInMessageList ? attachBots : undefined}
              peerType={attachMenuPeerType}
              shouldCollectDebugLogs={shouldCollectDebugLogs}
              theme={theme}
              onMenuOpen={onAttachMenuOpen}
              onMenuClose={onAttachMenuClose}
              messageListType={messageListType}
              paidMessagesStars={paidMessagesStars}
              canExpandRichInput={isInMessageList && !isRichInputExpansionActive}
              menuPositionX={isInMessageList ? 'left' : 'right'}
              onRichInputExpand={handleOpenRichInput}
            />
          )}
          <div
            className={buildClassName(
              'rich-editor-history',
              isRichInputExpansionActive && 'rich-editor-history-open',
            )}
            aria-hidden={!isRichInputExpansionActive}
            inert={!isRichInputExpansionActive}
          >
            <Button
              round
              faded
              size="smaller"
              color="translucent"
              ariaLabel={lang('Undo')}
              iconName="undo"
              disabled={!richEditor.canUndo}
              onClick={richEditor.undo}
            />
            <Button
              round
              faded
              size="smaller"
              color="translucent"
              ariaLabel={lang('Redo')}
              iconName="redo"
              disabled={!richEditor.canRedo}
              onClick={richEditor.redo}
            />
          </div>
          <Button
            round
            faded
            className={buildClassName(
              'rich-editor-button',
              !canToggleRichInput && 'rich-editor-button-hidden',
            )}
            color="translucent"
            ariaLabel={lang(isRichInputExpansionActive ? 'AriaComposerCloseRichInput' : 'AriaComposerOpenRichInput')}
            iconName={isRichInputExpansionActive ? 'collapse' : 'expand'}
            tabIndex={canToggleRichInput ? 0 : -1}
            onClick={isRichInputExpansionActive ? collapseRichInput : handleOpenRichInput}
          />
          <MessageInput
            ref={inputRef}
            id={inputId}
            editableInputId={editableInputId}
            richEditor={richEditor}
            tooltips={richEditorTooltips}
            isStoryInput={isInStoryViewer}
            chatId={chatId}
            canSendPlainText={!isComposerBlocked}
            isRichInputExpanded={isRichInputExpansionActive}
            threadId={threadId}
            isActive={!hasAttachments}
            placeholder={placeholder}
            forcedPlaceholder={inlineBotHelp}
            canAutoFocus={isReady && isForCurrentMessageList && !hasAttachments && isInMessageList}
            noFocusInterception={hasAttachments}
            shouldSuppressFocus={isMobile && isSymbolMenuOpen}
            onRichInputCollapse={collapseRichInput}
            onRichInputExpand={handleOpenRichInput}
            onSend={onSend}
            onSuppressedFocus={closeSymbolMenu}
            onFocus={markInputHasFocus}
            onBlur={unmarkInputHasFocus}
            isNeedPremium={isNeedPremium}
            messageListType={messageListType}
            isRichOnlyContent={hasRichOnlyContent}
            maxLength={isCurrentUserPremium || hasRichOnlyContent ? richMessageLengthLimit : maxMessageLength}
          />
          {isInMessageList && !isRichInputExpansionActive && (
            <>
              {isInlineBotLoading && (
                <Spinner color="gray" />
              )}
              <Transition
                className="composer-action-buttons-container"
                slideClassName="composer-action-buttons"
                activeKey={Number(hasInputContent)}
                direction="inverse"
                name="slideFadeAndroid"
              >
                {!hasInputContent && (
                  <>
                    {isChannel && (
                      <Transition
                        className="composer-action-button"
                        name="reveal"
                        activeKey={Number(isSilentPosting)}
                      >
                        <Button
                          round
                          faded
                          className="composer-action-button"
                          color="translucent"
                          onClick={handleToggleSilentPosting}
                          ariaLabel={lang(
                            isSilentPosting ? 'AriaComposerSilentPostingDisable' : 'AriaComposerSilentPostingEnable',
                          )}
                          iconName={isSilentPosting ? 'mute' : 'unmute'}
                        />
                      </Transition>
                    )}
                    {withScheduledButton && (
                      <Button
                        round
                        faded
                        className="composer-action-button scheduled-button"
                        color="translucent"
                        onClick={handleAllScheduledClick}
                        ariaLabel={lang('AriaComposerOpenScheduled')}
                        iconName="scheduled"
                      />
                    )}
                    {Boolean(autoDeletePeriod) && (
                      <Button
                        round
                        faded
                        className="composer-action-button"
                        color="translucent"
                        onClick={handleAutoDeleteClick}
                        ariaLabel={lang('AutoDeleteSetInfo', { time: formatCountdown(lang, autoDeletePeriod) })}
                      >
                        <AutoDeleteOutlinedIcon period={autoDeletePeriod} />
                      </Button>
                    )}
                    {shouldShowGiftButton && (
                      <Button
                        round
                        faded
                        className="composer-action-button"
                        color="translucent"
                        onClick={handleGiftClick}
                        iconName="closed-gift"
                      />
                    )}
                    {shouldShowSuggestedPostButton && (
                      <Button
                        round
                        faded
                        className="composer-action-button"
                        color="translucent"
                        onClick={handleSuggestPostClick}
                        iconName="cash-circle"
                      />
                    )}
                    {Boolean(botKeyboardMessageId) && !activeRecording && !editingMessage && (
                      <>
                        <ResponsiveHoverButton
                          className={buildClassName('composer-action-button', isBotKeyboardOpen && 'activated')}
                          round
                          color="translucent"
                          noClickActivation
                          onActivate={openBotKeyboard}
                          ariaLabel={lang('AriaComposerBotKeyboard')}
                        >
                          <Icon name="bot-command" />
                        </ResponsiveHoverButton>
                        {!isMobile && (
                          <BotKeyboardMenu
                            messageId={botKeyboardMessageId}
                            threadId={threadId}
                            isOpen={isBotKeyboardOpen}
                            onClose={closeBotKeyboard}
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </Transition>
            </>
          )}
          {shouldRenderVoiceRecordBar && renderedRecording && (
            <VoiceRecordBar
              ref={voiceRecordBarRef}
              recording={renderedRecording}
              isVideo={Boolean(activeVideoRecording)}
              isPaused={activeVideoRecording ? (isVideoRecordingPaused || isRecordingFinished) : isRecordingPaused}
              canSendOneTimeMedia={canSendOneTimeMedia}
              isViewOnceEnabled={isViewOnceEnabled}
              onPause={activeVideoRecording ? pauseRecordingVideo : pauseRecordingVoice}
              onResume={activeVideoRecording ? resumeRecordingVideo : resumeRecordingVoice}
              onCancel={activeVideoRecording ? discardRecordingVideo : cancelRecordingVoice}
              onToggleViewOnce={toggleViewOnceEnabled}
              subscribeToPeaks={activeVideoRecording ? subscribeToVideoRecordingPeaks : subscribeToRecordingPeaks}
            />
          )}
          {shouldRenderRoundVideoRecorder && (
            <RoundVideoRecorder
              ref={roundVideoRecorderRef}
              previewStream={renderedPreviewStream}
              isReady={isVideoRecordingReady}
              isPaused={isVideoRecordingPaused}
              isFrozen={isRecordingFinished}
              getProgress={getProgress}
              getPlaybackEl={renderedVideoRecording?.getPlaybackEl}
            />
          )}
          {((!isComposerBlocked || canSendGifs || canSendStickers) && !isNeedPremium && !isAccountFrozen) && (
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
              onGifAddCaption={hasRichOnlyContent ? undefined : handleGifAddCaption}
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
          {isInStoryViewer && !activeRecording && (
            <Button
              round
              className="composer-action-button story-reaction-button"
              color="translucent"
              onClick={handleLikeStory}
              onContextMenu={handleStoryPickerContextMenu}
              onMouseDown={handleBeforeStoryPickerContextMenu}
              ariaLabel={oldLang('AccDescrLike')}
              ref={storyReactionRef}
            >
              {sentStoryReaction && (
                <ReactionAnimatedEmoji
                  key={getReactionKey(sentStoryReaction)}
                  containerId={getStoryKey(chatId, storyId!)}
                  reaction={sentStoryReaction}
                  withEffectOnly={isSentStoryReactionHeart}
                />
              )}
              {(!sentStoryReaction || isSentStoryReactionHeart) && (
                <Icon
                  name={isSentStoryReactionHeart ? 'heart' : 'heart-outline'}
                  className={buildClassName(isSentStoryReactionHeart && 'story-reaction-heart')}
                />
              )}
            </Button>
          )}
          {isMobile && isInMessageList && Boolean(botKeyboardMessageId) && (
            <BotKeyboardMenu
              messageId={botKeyboardMessageId}
              threadId={threadId}
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
        </div>
      </div>
      <Button
        ref={mainButtonRef}
        round
        color={isInStoryViewer ? 'translucent' : 'secondary'}
        className={buildClassName(
          mainButtonState,
          'main-button',
          !isReady && 'not-ready',
          activeRecording && 'recording',
          isRecordingVideoMode && 'record-video',
          Boolean(paidMessagesStars) && 'has-paid-stars',
          isPaidSend && 'paid',
        )}
        disabled={areRecordingsNotAllowed}
        allowDisabledClick
        noFastClick
        ariaLabel={oldLang(sendButtonAriaLabel)}
        onClick={mainButtonHandler}
        onContextMenu={mainButtonContextMenuHandler}
      >
        <Icon name="new-send" className="main-button-state-icon" />
        <Icon name={isInStoryViewer ? 'microphone-outline' : 'microphone'} className="main-button-microphone" />
        <Icon name="round-video" />
        {onForward && <Icon name="forward" className="main-button-state-icon" />}
        {isInMessageList && <Icon name="schedule" className="main-button-state-icon" />}
        {isInMessageList && <Icon name="check-bold" className="main-button-state-icon" />}
        {shouldRenderPaidStars && (
          <div ref={paidStarsRef} className="paidStars">
            <Icon name="star" />
            <AnimatedCounter
              ref={counterRef}
              text={lang.number(starsForAllMessages)}
            />
          </div>
        )}
      </Button>
      {effectEmoji && (
        <span className="effect-icon" onClick={handleRemoveEffect}>
          {renderText(effectEmoji)}
        </span>
      )}
      {effect && canPlayEffect && (
        <MessageEffect
          shouldPlay={shouldPlayEffect}
          effect={effect}
          onStop={handleStopEffect}
        />
      )}
      {canShowCustomSendMenu && (
        <CustomSendMenu
          isOpen={isCustomSendMenuOpen}
          canSchedule={canSchedule && isInMessageList && !isViewOnceEnabled}
          canScheduleUntilOnline={canSchedule && canScheduleUntilOnline && !isViewOnceEnabled}
          onSendSilent={!isChatWithSelf ? handleSendSilent : undefined}
          onSendSchedule={!isInScheduledList ? handleSendScheduled : undefined}
          onSendWhenOnline={handleSendWhenOnline}
          onRemoveEffect={handleRemoveEffect}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          isSavedMessages={isChatWithSelf}
          chatId={chatId}
          withEffects={areEffectsSupported}
          hasCurrentEffect={Boolean(effect)}
          effectReactions={effectReactions}
          allAvailableReactions={availableReactions}
          onToggleReaction={handleToggleEffectReaction}
          isCurrentUserPremium={isCurrentUserPremium}
          isInSavedMessages={isChatWithSelf}
          isInStoryViewer={isInStoryViewer}
          canPlayAnimatedEmojis={canPlayAnimatedEmojis}
        />
      )}
      {canSwitchRecordMode && (
        <RecordModeMenu
          isOpen={isRecordModeMenuOpen}
          onSelectMode={handleSelectRecordMode}
          onClose={handleRecordModeMenuClose}
          onCloseAnimationEnd={handleRecordModeMenuHide}
        />
      )}
      {calendar}
      <PaymentMessageConfirmDialog
        isOpen={isPaymentMessageConfirmDialogOpen}
        onClose={closeConfirmModalPayForMessage}
        userName={chat ? getPeerTitle(lang, chat) : undefined}
        messagePriceInStars={paidMessagesStars || 0}
        messagesCount={messagesCount}
        shouldAutoApprove={shouldPaidMessageAutoApprove}
        setAutoApprove={setShouldPaidMessageAutoApprove}
        confirmHandler={paymentMessageConfirmDialogHandler}
      />
      {isInMessageList && (
        <RemoveFormattingModal
          isOpen={isRemoveFormattingModalOpen}
          onClose={handleCloseRemoveFormattingModal}
          onCloseAnimationEnd={handleRemoveFormattingModalCloseAnimationEnd}
          onRemoveFormatting={handleRemoveFormatting}
          onSubscribeToPremium={handleSubscribeToPremium}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    chatId, threadId, storyId, messageListType, isMobile, type,
  }): Complete<StateProps> => {
    const chat = selectChat(global, chatId);
    const chatBot = !isSystemBot(chatId) ? selectBot(global, chatId) : undefined;
    const isChatWithBot = Boolean(chatBot);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isChatWithUser = isUserId(chatId);
    const userFullInfo = isChatWithUser ? selectUserFullInfo(global, chatId) : undefined;
    const paidMessagesStars = selectPeerPaidMessagesStars(global, chatId);

    const chatFullInfo = !isChatWithUser ? selectChatFullInfo(global, chatId) : undefined;
    const messageWithActualBotKeyboard = (isChatWithBot || !isChatWithUser)
      && selectNewestMessageWithBotKeyboardButtons(global, chatId, threadId);
    const {
      shouldSuggestStickers, shouldSuggestCustomEmoji, shouldUpdateStickerSetOrder, shouldPaidMessageAutoApprove,
      lastRecordMessageMode,
    } = global.settings.byKey;
    const { language, shouldCollectDebugLogs } = selectSharedSettings(global);
    const {
      forwardMessages: { messageIds: forwardMessageIds },
      messageMediaEditorRequest,
    } = selectTabState(global);
    const mediaEditorMessage = messageMediaEditorRequest && messageMediaEditorRequest.chatId === chatId
      ? selectChatMessage(global, chatId, messageMediaEditorRequest.messageId)
      : undefined;
    const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
    const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;
    const botKeyboardMessageId = messageWithActualBotKeyboard ? messageWithActualBotKeyboard.id : undefined;
    const keyboardMessage = botKeyboardMessageId
      ? selectChatMessage(global, chatId, botKeyboardMessageId)
      || selectEphemeralMessage(global, chatId, botKeyboardMessageId)
      : undefined;
    const { currentUserId } = global;
    const currentUser = selectUser(global, currentUserId!)!;
    const defaultSendAsId = chatFullInfo ? chatFullInfo?.sendAsId || currentUserId : undefined;
    const sendAsId = defaultSendAsId;
    const sendAsPeer = sendAsId ? selectPeer(global, sendAsId) : undefined;
    const requestedDraft = selectRequestedDraft(global, chatId);
    const requestedDraftFiles = selectRequestedDraftFiles(global, chatId);

    const tabState = selectTabState(global);
    const isStoryViewerOpen = Boolean(tabState.storyViewer.storyId);

    const currentMessageList = selectCurrentMessageList(global);
    const isForCurrentMessageList = chatId === currentMessageList?.chatId
      && threadId === currentMessageList?.threadId
      && messageListType === currentMessageList?.type
      && !isStoryViewerOpen;
    const user = selectUser(global, chatId);
    const canSendVoiceByPrivacy = (user && !userFullInfo?.noVoiceMessages) ?? true;
    const slowMode = chatFullInfo?.slowMode;
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    const editingDraft = messageListType === 'scheduled'
      ? selectEditingScheduledDraft(global, chatId)
      : selectEditingDraft(global, chatId, threadId);

    const story = storyId && selectPeerStory(global, chatId, storyId);
    const sentStoryReaction = story && 'sentReaction' in story ? story.sentReaction : undefined;
    const draft = selectDraft(global, chatId, threadId);
    const replyToMessage = draft?.replyInfo
      ? selectChatMessage(global, chatId, draft.replyInfo.replyToMsgId)
      : undefined;
    const replyToTopic = chat?.isForum && chat.isForumAsMessages && threadId === MAIN_THREAD_ID && replyToMessage
      ? selectTopicFromMessage(global, replyToMessage)
      : undefined;
    const isInScheduledList = messageListType === 'scheduled';

    const canSendQuickReplies = isChatWithUser && !isChatWithBot && !isInScheduledList && !isChatWithSelf;

    const noWebPage = selectNoWebPage(global, chatId, threadId);
    const isSilentPosting = chat && getChatNotifySettings(
      chat,
      selectNotifyDefaults(global),
      selectNotifyException(global, chatId),
    )?.isSilentPosting;

    const areEffectsSupported = isChatWithUser && !isChatWithBot
      && !isInScheduledList && !isChatWithSelf && type !== 'story' && chatId !== SERVICE_NOTIFICATIONS_USER_ID;
    const canPlayEffect = selectPerformanceSettingsValue(global, 'stickerEffects');
    const shouldPlayEffect = tabState.shouldPlayEffectInComposer;
    const effectId = areEffectsSupported && draft?.effectId;
    const effect = effectId ? global.availableEffectById[effectId] : undefined;
    const effectReactions = global.reactions.effectReactions;

    const maxMessageLength = selectCurrentLimit(global, 'messageLength');
    const isForwarding = chatId === tabState.forwardMessages.toChatId;
    const isReplying = Boolean(draft?.replyInfo);
    const hasSuggestedPost = Boolean(draft?.suggestedPostInfo);
    const starsBalance = global.stars?.balance.amount || 0;
    const isStarsBalanceModalOpen = Boolean(tabState.starsBalanceModal);
    const isAccountFrozen = selectIsCurrentUserFrozen(global);
    const isAppConfigLoaded = global.isAppConfigLoaded;
    const insertingPeerIdMention = tabState.insertingPeerIdMention;

    const webPagePreview = tabState.webPagePreviewId ? selectWebPage(global, tabState.webPagePreviewId) : undefined;

    const canManageAutoDelete = type === 'messageList' && messageListType === 'thread' && threadId === MAIN_THREAD_ID
      && selectCanManageAutoDelete(global, chatId);
    const autoDeletePeriod = canManageAutoDelete ? selectChatHistoryTtl(global, chatId) : undefined;

    return {
      availableReactions: global.reactions.availableReactions,
      topReactions: type === 'story' ? global.reactions.topReactions : undefined,
      isOnActiveTab: !tabState.isBlurred,
      recordMode: lastRecordMessageMode ?? 'voice',
      editingMessage: selectEditingMessage(global, chatId, threadId, messageListType),
      draft,
      chat,
      user,
      isChatWithBot,
      isChatWithSelf,
      isForCurrentMessageList,
      canScheduleUntilOnline: selectCanScheduleUntilOnline(global, chatId),
      isChannel: chat ? isChatChannel(chat) : undefined,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      isSelectModeActive: selectIsInSelectMode(global),
      withScheduledButton: (
        messageListType === 'thread'
        && (userFullInfo || chatFullInfo)?.hasScheduledMessages
      ),
      autoDeletePeriod: autoDeletePeriod || undefined,
      isInScheduledList,
      botKeyboardMessageId,
      botKeyboardPlaceholder: keyboardMessage?.keyboardPlaceholder,
      isForwarding,
      isReplying,
      hasSuggestedPost,
      forwardedMessagesCount: isForwarding ? forwardMessageIds!.length : undefined,
      todoListModal: tabState.todoListModal,
      aiMessageEditorPendingResult: tabState.aiMessageEditorPendingResult,
      chatFullInfo,
      topInlineBotIds: global.topPeerCategories.botsInline?.peerIds,
      topGuestBotIds: global.topPeerCategories.botsGuestChat?.peerIds,
      currentUserId,
      currentUser,
      contentToBeScheduled: tabState.contentToBeScheduled,
      shouldSuggestStickers,
      shouldSuggestCustomEmoji,
      shouldUpdateStickerSetOrder,
      recentEmojis: global.recentEmojis,
      baseEmojiKeywords: baseEmojiKeywords?.keywords,
      emojiKeywords: emojiKeywords?.keywords,
      inlineBots: tabState.inlineBots.byUsername,
      isInlineBotLoading: tabState.inlineBots.isLoading,
      botCommands: userFullInfo ? (userFullInfo.botInfo?.commands || false) : undefined,
      botMenuButton: userFullInfo?.botInfo?.menuButton,
      sendAsPeer,
      sendAsId,
      editingDraft,
      requestedDraft,
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
      canSendOneTimeMedia: !isChatWithSelf && isChatWithUser && !isChatWithBot && !isInScheduledList,
      shouldCollectDebugLogs,
      sentStoryReaction,
      stealthMode: global.stories.stealthMode,
      replyToTopic,
      quickReplyMessages: global.quickReplies.messagesById,
      quickReplies: global.quickReplies.byId,
      canSendQuickReplies,
      noWebPage,
      webPagePreview,
      isContactRequirePremium: userFullInfo?.isContactRequirePremium,
      effect,
      effectReactions,
      areEffectsSupported,
      canPlayEffect,
      shouldPlayEffect,
      maxMessageLength,
      richMessageLengthLimit: global.appConfig.richMessageLengthLimit,
      richMessageMaxBlocks: global.appConfig.richMessageMaxBlocks,
      richMessageMaxDepth: global.appConfig.richMessageMaxDepth,
      richMessageMaxMedia: global.appConfig.richMessageMaxMedia,
      richMessageMaxTableColumns: global.appConfig.richMessageMaxTableColumns,
      paidMessagesStars,
      shouldPaidMessageAutoApprove,
      isSilentPosting,
      isPaymentMessageConfirmDialogOpen: tabState.isPaymentMessageConfirmDialogOpen
        && !tabState.aiMessageEditorModal
        && !tabState.pollModal
        && !tabState.sharePreparedMessageModal,
      starsBalance,
      isStarsBalanceModalOpen,
      shouldDisplayGiftsButton: userFullInfo?.shouldDisplayGiftsButton,
      disallowedGifts: userFullInfo?.disallowedGifts,
      isAccountFrozen,
      isAppConfigLoaded,
      insertingPeerIdMention,
      isRichInputExpanded: tabState.isRichInputExpanded,
      mediaEditorMessage,
    };
  },
)(Composer));
