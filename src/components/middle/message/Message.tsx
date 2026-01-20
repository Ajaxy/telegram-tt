import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useUnmountCleanup,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiAvailableEffect,
  ApiAvailableReaction,
  ApiChat,
  ApiChatMember,
  ApiKeyboardButton,
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiPeer,
  ApiPoll,
  ApiReaction,
  ApiReactionKey,
  ApiSavedReactionTag,
  ApiThreadInfo,
  ApiTopic,
  ApiTypeStory,
  ApiUser,
  ApiWebPage,
} from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type {
  ActiveEmojiInteraction,
  ChatTranslatedMessages,
  FocusDirection,
  IAlbum,
  MessageListType,
  ScrollTargetPosition,
  TextSummary,
  ThemeKey,
  ThreadId,
} from '../../../types';
import type { Signal } from '../../../util/signals';
import type { OnIntersectPinnedMessage } from '../hooks/usePinnedMessage';
import { MAIN_THREAD_ID } from '../../../api/types';
import { AudioOrigin } from '../../../types';

import { EMOJI_STATUS_LOOP_LIMIT, MESSAGE_APPEARANCE_DELAY } from '../../../config';
import {
  areReactionsEmpty,
  getIsDownloading,
  getMainUsername,
  getMessageContent,
  getMessageCustomShape,
  getMessageHtmlId,
  getMessageSingleCustomEmoji,
  getMessageSingleRegularEmoji,
  getMessageWebPage,
  hasMessageText,
  hasMessageTtl,
  isAnonymousForwardsChat,
  isAnonymousOwnMessage,
  isChatChannel,
  isChatGroup,
  isChatPublic,
  isGeoLiveExpired,
  isMessageLocal,
  isMessageTranslatable,
  isOwnMessage,
  isReplyToMessage,
  isSystemBot,
} from '../../../global/helpers';
import { getPeerFullTitle } from '../../../global/helpers/peers';
import { getMessageReplyInfo, getStoryReplyInfo } from '../../../global/helpers/replies';
import {
  selectActiveDownloads,
  selectAnimatedEmoji,
  selectCanAutoLoadMedia,
  selectCanAutoPlayMedia,
  selectCanReplyToMessage,
  selectChat,
  selectChatFullInfo,
  selectChatMessage,
  selectChatTranslations,
  selectCurrentMiddleSearch,
  selectDefaultReaction,
  selectForwardedSender,
  selectFullWebPageFromMessage,
  selectIsChatProtected,
  selectIsChatRestricted,
  selectIsChatWithSelf,
  selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
  selectIsDocumentGroupSelected,
  selectIsInSelectMode,
  selectIsMessageFocused,
  selectIsMessageProtected,
  selectIsMessageSelected,
  selectMessageIdsByGroupId,
  selectMessageSummary,
  selectOutgoingStatus,
  selectPeer,
  selectPeerStory,
  selectPerformanceSettingsValue,
  selectPollFromMessage,
  selectReplyMessage,
  selectRequestedChatTranslationLanguage,
  selectRequestedMessageTranslationLanguage,
  selectSender,
  selectSenderFromHeader,
  selectShouldDetectChatLanguage,
  selectShouldLoopStickers,
  selectTabState,
  selectTheme,
  selectThreadInfo,
  selectTopicFromMessage,
  selectUploadProgress,
  selectUser,
} from '../../../global/selectors';
import {
  selectIsMediaNsfw,
  selectMessageDownloadableMedia,
  selectMessageLastPlaybackTimestamp,
  selectMessageTimestampableDuration,
} from '../../../global/selectors/media';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { IS_TAURI } from '../../../util/browser/globalEnvironment';
import { IS_ANDROID, IS_TRANSLATION_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { isUserId } from '../../../util/entities/ids';
import { getMessageKey } from '../../../util/keys/messageKey';
import { getServerTime } from '../../../util/serverTime';
import stopEvent from '../../../util/stopEvent';
import { isElementInViewport } from '../../../util/visibility/isElementInViewport';
import { calculateDimensionsForMessageMedia, getStickerDimensions, REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import { getCustomEmojiSize } from '../composer/helpers/customEmoji';
import { buildContentClassName } from './helpers/buildContentClassName';
import { calculateAlbumLayout } from './helpers/calculateAlbumLayout';
import getSingularPaidMedia from './helpers/getSingularPaidMedia';
import { calculateMediaDimensions, getMinMediaWidth, getMinMediaWidthWithText } from './helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import useEnsureStory from '../../../hooks/useEnsureStory';
import useFlag from '../../../hooks/useFlag';
import { useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import usePeerColor from '../../../hooks/usePeerColor';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransition from '../../../hooks/useShowTransition';
import useTextLanguage from '../../../hooks/useTextLanguage';
import useDetectChatLanguage from './hooks/useDetectChatLanguage';
import useFocusMessageListElement from './hooks/useFocusMessageListElement';
import useInnerHandlers from './hooks/useInnerHandlers';
import useMessageTranslation from './hooks/useMessageTranslation';
import useOuterHandlers from './hooks/useOuterHandlers';

import Audio from '../../common/Audio';
import Avatar from '../../common/Avatar';
import CustomEmoji from '../../common/CustomEmoji';
import Document from '../../common/Document';
import DotAnimation from '../../common/DotAnimation';
import EmbeddedMessage from '../../common/embedded/EmbeddedMessage';
import EmbeddedStory from '../../common/embedded/EmbeddedStory';
import FakeIcon from '../../common/FakeIcon';
import Icon from '../../common/icons/Icon';
import StarIcon from '../../common/icons/StarIcon';
import MessageText from '../../common/MessageText';
import PeerColorWrapper from '../../common/PeerColorWrapper';
import ReactionStaticEmoji from '../../common/reactions/ReactionStaticEmoji';
import Sparkles from '../../common/Sparkles';
import TopicChip from '../../common/TopicChip';
import { animateSnap } from '../../main/visualEffects/SnapEffectContainer';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import InputText from '../../ui/InputText';
import Album from './Album';
import AnimatedCustomEmoji from './AnimatedCustomEmoji';
import AnimatedEmoji from './AnimatedEmoji';
import CommentButton from './CommentButton';
import Contact from './Contact';
import ContextMenuContainer from './ContextMenuContainer.async';
import DiceWrapper from './dice/DiceWrapper';
import FactCheck from './FactCheck';
import Game from './Game';
import Giveaway from './Giveaway';
import InlineButtons from './InlineButtons';
import Invoice from './Invoice';
import InvoiceMediaPreview from './InvoiceMediaPreview';
import Location from './Location';
import MessageAppendix from './MessageAppendix';
import MessageEffect from './MessageEffect';
import MessageMeta from './MessageMeta';
import MessagePhoneCall from './MessagePhoneCall';
import PaidMediaOverlay from './PaidMediaOverlay';
import Photo from './Photo';
import Poll from './Poll';
import Reactions from './reactions/Reactions';
import RoundVideo from './RoundVideo';
import Sticker from './Sticker';
import Story from './Story';
import StoryMention from './StoryMention';
import TodoList from './TodoList';
import Video from './Video';
import WebPage from './WebPage';

import './Message.scss';

type MessagePositionProperties = {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isFirstInDocumentGroup: boolean;
  isLastInDocumentGroup: boolean;
  isLastInList: boolean;
};

type OwnProps = {
  message: ApiMessage;
  album?: IAlbum;
  noAvatars?: boolean;
  withAvatar?: boolean;
  withSenderName?: boolean;
  threadId: ThreadId;
  messageListType: MessageListType;
  noComments: boolean;
  noReplies: boolean;
  appearanceOrder: number;
  isJustAdded: boolean;
  memoFirstUnreadIdRef?: { current: number | undefined };
  getIsMessageListReady?: Signal<boolean>;
  observeIntersectionForBottom?: ObserveFn;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onIntersectPinnedMessage?: OnIntersectPinnedMessage;
} & MessagePositionProperties;

type StateProps = {
  theme: ThemeKey;
  forceSenderName?: boolean;
  sender?: ApiPeer;
  canShowSender: boolean;
  originSender?: ApiPeer;
  botSender?: ApiUser;
  isThreadTop?: boolean;
  shouldHideReply?: boolean;
  replyMessage?: ApiMessage;
  replyMessageSender?: ApiPeer;
  replyMessageForwardSender?: ApiPeer;
  replyMessageChat?: ApiChat;
  isReplyPrivate?: boolean;
  replyStory?: ApiTypeStory;
  storySender?: ApiPeer;
  outgoingStatus?: ApiMessageOutgoingStatus;
  uploadProgress?: number;
  isInDocumentGroup: boolean;
  isProtected?: boolean;
  isChatProtected?: boolean;
  isFocused?: boolean;
  focusDirection?: FocusDirection;
  focusedQuote?: string;
  focusedQuoteOffset?: number;
  noFocusHighlight?: boolean;
  scrollTargetPosition?: ScrollTargetPosition;
  isResizingContainer?: boolean;
  isForwarding?: boolean;
  isChatWithSelf?: boolean;
  isBotForum?: boolean;
  isRepliesChat?: boolean;
  isAnonymousForwards?: boolean;
  isChannel?: boolean;
  isGroup?: boolean;
  canReply?: boolean;
  highlight?: string;
  animatedEmoji?: string;
  animatedCustomEmoji?: string;
  hasActiveReactions?: boolean;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  isGroupSelected?: boolean;
  isDownloading?: boolean;
  threadId?: ThreadId;
  isPinnedList?: boolean;
  isPinned?: boolean;
  canAutoLoadMedia?: boolean;
  canAutoPlayMedia?: boolean;
  hasLinkedChat?: boolean;
  shouldLoopStickers?: boolean;
  autoLoadFileMaxSizeMb: number;
  repliesThreadInfo?: ApiThreadInfo;
  reactionMessage?: ApiMessage;
  availableReactions?: ApiAvailableReaction[];
  defaultReaction?: ApiReaction;
  activeEmojiInteractions?: ActiveEmojiInteraction[];
  hasUnreadReaction?: boolean;
  isTranscribing?: boolean;
  transcribedText?: string;
  isPremium: boolean;
  senderAdminMember?: ApiChatMember;
  messageTopic?: ApiTopic;
  hasTopicChip?: boolean;
  chatTranslations?: ChatTranslatedMessages;
  areTranslationsEnabled?: boolean;
  shouldDetectChatLanguage?: boolean;
  requestedTranslationLanguage?: string;
  requestedChatTranslationLanguage?: string;
  withAnimatedEffects?: boolean;
  webPageStory?: ApiTypeStory;
  isConnected: boolean;
  isLoadingComments?: boolean;
  shouldWarnAboutFiles?: boolean;
  senderBoosts?: number;
  tags?: Record<ApiReactionKey, ApiSavedReactionTag>;
  canTranscribeVoice?: boolean;
  viaBusinessBot?: ApiUser;
  effect?: ApiAvailableEffect;
  poll?: ApiPoll;
  webPage?: ApiWebPage;
  maxTimestamp?: number;
  lastPlaybackTimestamp?: number;
  paidMessageStars?: number;
  isChatWithUser?: boolean;
  isAccountFrozen?: boolean;
  minFutureTime?: number;
  isMediaNsfw?: boolean;
  isReplyMediaNsfw?: boolean;
  summary?: TextSummary;
};

type MetaPosition =
  'in-text'
  | 'standalone'
  | 'none';
type ReactionsPosition =
  'inside'
  | 'outside'
  | 'none';
type QuickReactionPosition =
  'in-content'
  | 'in-meta';

const NBSP = '\u00A0';
const QUICK_REACTION_SIZE = 1.75 * REM;
const EXTRA_SPACE_FOR_REACTIONS = 2.25 * REM;
const MAX_REASON_LENGTH = 200;

const Message = ({
  message,
  observeIntersectionForBottom,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  album,
  noAvatars,
  withAvatar,
  withSenderName,
  noComments,
  noReplies,
  appearanceOrder,
  isJustAdded,
  isFirstInGroup,
  isPremium,
  isLastInGroup,
  isFirstInDocumentGroup,
  isLastInDocumentGroup,
  isTranscribing,
  transcribedText,
  isLastInList,
  theme,
  forceSenderName,
  sender,
  canShowSender,
  originSender,
  botSender,
  isThreadTop,
  shouldHideReply,
  replyMessage,
  replyMessageSender,
  replyMessageForwardSender,
  replyMessageChat,
  replyStory,
  isReplyPrivate,
  storySender,
  outgoingStatus,
  uploadProgress,
  isInDocumentGroup,
  isLoadingComments,
  isProtected,
  isChatProtected,
  isFocused,
  focusDirection,
  focusedQuote,
  focusedQuoteOffset,
  noFocusHighlight,
  scrollTargetPosition,
  isResizingContainer,
  isForwarding,
  isChatWithSelf,
  isBotForum,
  isRepliesChat,
  isAnonymousForwards,
  isChannel,
  isGroup,
  canReply,
  highlight,
  animatedEmoji,
  animatedCustomEmoji,
  hasActiveReactions,
  hasLinkedChat,
  isInSelectMode,
  isSelected,
  isGroupSelected,
  threadId,
  reactionMessage,
  availableReactions,
  defaultReaction,
  activeEmojiInteractions,
  messageListType,
  isPinnedList,
  isPinned,
  isDownloading,
  canAutoLoadMedia,
  canAutoPlayMedia,
  shouldLoopStickers,
  autoLoadFileMaxSizeMb,
  repliesThreadInfo,
  hasUnreadReaction,
  memoFirstUnreadIdRef,
  senderAdminMember,
  messageTopic,
  hasTopicChip,
  chatTranslations,
  areTranslationsEnabled,
  shouldDetectChatLanguage,
  requestedTranslationLanguage,
  requestedChatTranslationLanguage,
  withAnimatedEffects,
  webPageStory,
  isConnected,
  getIsMessageListReady,
  shouldWarnAboutFiles,
  senderBoosts,
  tags,
  canTranscribeVoice,
  viaBusinessBot,
  effect,
  poll,
  maxTimestamp,
  lastPlaybackTimestamp,
  isMediaNsfw,
  isReplyMediaNsfw,
  paidMessageStars,
  isChatWithUser,
  isAccountFrozen,
  minFutureTime,
  webPage,
  summary,
  onIntersectPinnedMessage,
}: OwnProps & StateProps) => {
  const {
    toggleMessageSelection,
    clickBotInlineButton,
    clickSuggestedMessageButton,
    rejectSuggestedPost,
    openSuggestedPostApprovalModal,
    disableContextMenuHint,
    animateUnreadReaction,
    focusMessage,
    markMentionsRead,
    openThread,
    summarizeMessage,
  } = getActions();

  const ref = useRef<HTMLDivElement>();
  const bottomMarkerRef = useRef<HTMLDivElement>();
  const quickReactionRef = useRef<HTMLDivElement>();

  const oldLang = useOldLang();
  const lang = useLang();

  const [isTranscriptionHidden, setTranscriptionHidden] = useState(false);
  const [isPlayingSnapAnimation, setIsPlayingSnapAnimation] = useState(false);
  const [isPlayingDeleteAnimation, setIsPlayingDeleteAnimation] = useState(false);
  const [shouldPlayEffect, requestEffect, hideEffect] = useFlag();
  const [shouldPlayDiceEffect, requestDiceEffect, hideDiceEffect] = useFlag();
  const [isDeclineDialogOpen, openDeclineDialog, closeDeclineDialog] = useFlag();
  const [isShowingSummary, showSummary, hideSummary] = useFlag();
  const [declineReason, setDeclineReason] = useState('');
  const { isMobile, isTouchScreen } = useAppLayout();

  useOnIntersect(bottomMarkerRef, observeIntersectionForBottom);

  const {
    isContextMenuOpen,
    contextMenuAnchor,
    contextMenuTarget,
    handleBeforeContextMenu,
    handleContextMenu: onContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(
    ref,
    (isTouchScreen && isInSelectMode) || isAccountFrozen,
    !IS_TAURI,
    IS_ANDROID,
    getIsMessageListReady,
  );

  useEffect(() => {
    if (isContextMenuOpen) {
      disableContextMenuHint();
    }
  }, [isContextMenuOpen, disableContextMenuHint]);

  const noAppearanceAnimation = appearanceOrder <= 0;
  const [isShown, markShown] = useFlag(noAppearanceAnimation);
  useEffect(() => {
    if (noAppearanceAnimation) {
      return;
    }

    setTimeout(markShown, appearanceOrder * MESSAGE_APPEARANCE_DELAY);
  }, [appearanceOrder, markShown, noAppearanceAnimation]);

  useShowTransition({
    ref,
    isOpen: isShown || isJustAdded,
    noMountTransition: noAppearanceAnimation && !isJustAdded,
    className: false,
  });

  const {
    id: messageId, chatId, forwardInfo, viaBotId, isTranscriptionError, factCheck,
    isTypingDraft,
  } = message;
  const hasSummary = Boolean(message.summaryLanguageCode);

  useUnmountCleanup(() => {
    if (message.isPinned) {
      const id = album ? album.mainMessage.id : messageId;
      onIntersectPinnedMessage?.({ viewportPinnedIdsToRemove: [id] });
    }
  });

  const isLocal = isMessageLocal(message);
  const isOwn = isOwnMessage(message);
  const isScheduled = messageListType === 'scheduled' || message.isScheduled;
  const hasMessageReply = isReplyToMessage(message) && !shouldHideReply;

  const { paidMedia } = getMessageContent(message);
  const { photo: paidMediaPhoto, video: paidMediaVideo } = getSingularPaidMedia(paidMedia);

  const {
    photo = paidMediaPhoto, video = paidMediaVideo, audio,
    voice, document, sticker, contact,
    invoice, location,
    action, game, storyData, giveaway,
    giveawayResults, todo, dice,
  } = getMessageContent(message);

  const messageReplyInfo = getMessageReplyInfo(message);
  const storyReplyInfo = getStoryReplyInfo(message);

  const withVoiceTranscription = Boolean(!isTranscriptionHidden && (isTranscriptionError || transcribedText));

  const hasStoryReply = Boolean(storyReplyInfo);
  const hasThread = Boolean(repliesThreadInfo) && messageListType === 'thread';
  const isCustomShape = !withVoiceTranscription && getMessageCustomShape(message);
  const hasAnimatedEmoji = isCustomShape && (animatedEmoji || animatedCustomEmoji);
  const hasReactions = reactionMessage?.reactions && !areReactionsEmpty(reactionMessage.reactions);
  const asForwarded = (
    forwardInfo
    && (!isChatWithSelf || isScheduled)
    && !isRepliesChat
    && !forwardInfo.isLinkedChannelPost
    && !isAnonymousForwards
    && !botSender
  ) || Boolean(storyData && !storyData.isMention);
  const canShowSenderBoosts = Boolean(senderBoosts) && !asForwarded && isFirstInGroup;
  const isStoryMention = storyData?.isMention;
  const isRoundVideo = video?.mediaType === 'video' && video.isRound;
  const isAlbum = Boolean(album)
    && (
      (album.isPaidMedia && paidMedia!.extendedMedia.length > 1)
      || album.messages.length > 1
    ) && !album.messages.some((msg) => Object.keys(msg.content).length === 0);
  const isInDocumentGroupNotFirst = isInDocumentGroup && !isFirstInDocumentGroup;
  const isInDocumentGroupNotLast = isInDocumentGroup && !isLastInDocumentGroup;
  const isContextMenuShown = contextMenuAnchor !== undefined;
  const canShowActionButton = (
    !(isContextMenuShown || isInSelectMode || isForwarding)
    && !isInDocumentGroupNotLast
    && !isStoryMention
  );
  const canForward = isChannel && !isScheduled && message.isForwardingAllowed
    && !isChatProtected;
  const canFocus = Boolean(isPinnedList
    || (forwardInfo
      && (forwardInfo.isChannelPost || isChatWithSelf || isRepliesChat || isAnonymousForwards)
      && forwardInfo.fromMessageId
    ));

  const hasFactCheck = Boolean(factCheck?.text);

  const hasForwardedCustomShape = asForwarded && isCustomShape;
  const hasSubheader = hasTopicChip || hasMessageReply || hasStoryReply || hasForwardedCustomShape
    || Boolean(isShowingSummary && summary?.text);

  const selectMessage = useLastCallback((e?: React.MouseEvent<HTMLDivElement, MouseEvent>, groupedId?: string) => {
    if (isAccountFrozen) return;
    toggleMessageSelection({
      messageId,
      groupedId,
      ...(e?.shiftKey && { withShift: true }),
      ...(isAlbum && { childMessageIds: album.messages.map(({ id }) => id) }),
    });
  });

  const messageSender = canShowSender ? sender : undefined;

  const shouldPreferOriginSender = forwardInfo
    && (isChatWithSelf || isRepliesChat || isAnonymousForwards || !messageSender);
  const avatarPeer = shouldPreferOriginSender ? originSender : messageSender;

  const messageColorPeer = asForwarded ? originSender : sender;
  const noUserColors = isOwn && !isCustomShape;

  const senderPeer = (forwardInfo || storyData) ? originSender : messageSender;
  const hasTtl = hasMessageTtl(message);

  const {
    handleMouseDown,
    handleClick,
    handleContextMenu,
    handleDoubleClick,
    handleContentDoubleClick,
    handleMouseMove,
    handleSendQuickReaction,
    handleMouseLeave,
    isSwiped,
    isQuickReactionVisible,
    handleDocumentGroupMouseEnter,
  } = useOuterHandlers(
    selectMessage,
    ref,
    messageId,
    Boolean(isInSelectMode),
    Boolean(canReply),
    Boolean(isProtected),
    onContextMenu,
    handleBeforeContextMenu,
    chatId,
    isContextMenuShown,
    quickReactionRef,
    isInDocumentGroupNotLast,
    getIsMessageListReady,
  );

  const {
    handleSenderClick,
    handleViaBotClick,
    handleReplyClick,
    handleMediaClick,
    handleDocumentClick,
    handleAudioPlay,
    handleAlbumMediaClick,
    handlePhotoMediaClick,
    handleVideoMediaClick,
    handleMetaClick,
    handleTranslationClick,
    handleOpenThread,
    handleReadMedia,
    handleCancelUpload,
    handleVoteSend,
    handleGroupForward,
    handleForward,
    handleFocus,
    handleFocusForwarded,
    handleDocumentGroupSelectAll,
    handleTopicChipClick,
    handleStoryClick,
  } = useInnerHandlers({
    lang: oldLang,
    selectMessage,
    message,
    webPage,
    chatId,
    threadId,
    isInDocumentGroup,
    asForwarded,
    isScheduled,
    album,
    avatarPeer,
    senderPeer,
    botSender,
    messageTopic,
    isTranslatingChat: Boolean(requestedChatTranslationLanguage),
    story: replyStory && 'content' in replyStory ? replyStory : undefined,
    isReplyPrivate,
    isRepliesChat,
    isSavedMessages: isChatWithSelf,
    lastPlaybackTimestamp,
  });

  useEffect(() => {
    if (hasSummary && isShowingSummary && !summary) {
      summarizeMessage({
        chatId,
        id: message.id,
        toLanguageCode: requestedTranslationLanguage,
      });
    }
  }, [hasSummary, chatId, message.id, requestedTranslationLanguage, isShowingSummary, summary]);

  const handleEffectClick = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    requestEffect();
  });

  const handleFocusSelf = useLastCallback(() => {
    focusMessage({
      chatId,
      threadId,
      messageId,
      scrollTargetPosition: 'start',
      noHighlight: true,
    });
  });

  useEffect(() => {
    if (!isLastInList) {
      return;
    }

    if (withVoiceTranscription && transcribedText) {
      handleFocusSelf();
    }
  }, [isLastInList, transcribedText, withVoiceTranscription]);

  useEffect(() => {
    const element = ref.current;
    const isPartialAlbumDelete = message.isInAlbum && album?.messages.some((msg) => !msg.isDeleting);
    if (message.isDeleting && element && !isPartialAlbumDelete) {
      if (animateSnap(element)) {
        setIsPlayingSnapAnimation(true);
      } else {
        setIsPlayingDeleteAnimation(true);
      }
    }
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps -- Only start animation on `isDeleting` change
  }, [message.isDeleting]);

  const textMessage = album?.hasMultipleCaptions ? undefined : (album?.captionMessage || message);
  const hasTextContent = textMessage && hasMessageText(textMessage);
  const hasText = hasTextContent || hasFactCheck;

  const containerClassName = buildClassName(
    'Message message-list-item',
    isFirstInGroup && 'first-in-group',
    isProtected && 'hide-on-print',
    isProtected && !hasTextContent ? 'is-protected' : 'allow-selection',
    isLastInGroup && 'last-in-group',
    isFirstInDocumentGroup && 'first-in-document-group',
    isLastInDocumentGroup && 'last-in-document-group',
    isLastInList && 'last-in-list',
    isOwn && 'own',
    Boolean(message.viewsCount) && 'has-views',
    message.isEdited && 'was-edited',
    hasMessageReply && 'has-reply',
    isContextMenuOpen && 'has-menu-open',
    isFocused && !noFocusHighlight && 'focused',
    isForwarding && 'is-forwarding',
    isPlayingDeleteAnimation && 'is-deleting',
    isPlayingSnapAnimation && 'is-dissolving',
    isInDocumentGroup && 'is-in-document-group',
    isAlbum && 'is-album',
    message.hasUnreadMention && 'has-unread-mention',
    isSelected && 'is-selected',
    isInSelectMode && 'is-in-selection-mode',
    isThreadTop && !withAvatar && 'is-thread-top',
    Boolean(message.inlineButtons) && 'has-inline-buttons',
    isSwiped && 'is-swiped',
    isJustAdded && 'is-just-added',
    (hasActiveReactions || shouldPlayEffect) && 'has-active-effect',
    isStoryMention && 'is-story-mention',
  );

  const text = textMessage && getMessageContent(textMessage).text;
  const isInvertedMedia = Boolean(message.isInvertedMedia);

  const { replyToMsgId, replyToPeerId } = messageReplyInfo || {};
  const { peerId: storyReplyPeerId, storyId: storyReplyId } = storyReplyInfo || {};

  useEffect(() => {
    if ((sticker?.hasEffect || effect) && ((
      memoFirstUnreadIdRef?.current && messageId >= memoFirstUnreadIdRef.current
    ) || isLocal)) {
      requestEffect();
    }
  }, [effect, isLocal, memoFirstUnreadIdRef, messageId, sticker?.hasEffect]);

  useEffect(() => {
    if (dice && ((
      memoFirstUnreadIdRef?.current && messageId >= memoFirstUnreadIdRef.current
    ) || isLocal)) {
      requestDiceEffect();
    }
  }, [dice, memoFirstUnreadIdRef, messageId, isLocal]);

  const detectedLanguage = useTextLanguage(
    text?.text,
    !(areTranslationsEnabled && shouldDetectChatLanguage) || isTypingDraft,
    getIsMessageListReady,
  );
  useDetectChatLanguage(message, detectedLanguage, !shouldDetectChatLanguage, getIsMessageListReady);

  const shouldTranslate = isMessageTranslatable(message, !requestedChatTranslationLanguage);
  const { isPending: isTranslationPending, translatedText } = useMessageTranslation(
    chatTranslations, chatId, shouldTranslate ? messageId : undefined, requestedTranslationLanguage,
  );
  const isSummaryPending = Boolean(summary?.isPending);
  const isNewTextPending = isTranslationPending || isSummaryPending;
  // Used to display previous result while new one is loading
  const previousTranslatedText = usePreviousDeprecated(translatedText, Boolean(shouldTranslate));

  useEffectWithPrevDeps(([prevIsShowingSummary]) => {
    if (summary?.text || (prevIsShowingSummary && !isShowingSummary)) {
      handleFocusSelf();
    }
  }, [isShowingSummary, summary?.text]);

  const currentTranslatedText = translatedText || previousTranslatedText;

  const phoneCall = action?.type === 'phoneCall' ? action : undefined;

  const commentsThreadInfo = repliesThreadInfo?.isCommentsInfo ? repliesThreadInfo : undefined;
  const isLocalWithCommentButton = hasLinkedChat && isChannel && isLocal;

  const isMediaWithCommentButton = (commentsThreadInfo || isLocalWithCommentButton)
    && !isInDocumentGroupNotLast
    && messageListType === 'thread'
    && !noComments;
  const withCommentButton = (commentsThreadInfo || isLocalWithCommentButton)
    && !isInDocumentGroupNotLast && messageListType === 'thread'
    && !noComments;
  const withQuickReactionButton = !isTouchScreen && !phoneCall && !isInSelectMode && defaultReaction
    && !isInDocumentGroupNotLast && !isStoryMention && !hasTtl && !isAccountFrozen;

  const hasOutsideReactions = !withVoiceTranscription && hasReactions
    && (isCustomShape || (
      (photo || video || storyData || (location?.mediaType === 'geo')) && (!hasText || isInvertedMedia))
    );

  const { className: peerColorClass, style: peerColorStyle } = usePeerColor({
    peer: messageColorPeer,
    noUserColors,
    shouldReset: true,
    theme,
  });

  const contentClassName = buildContentClassName(message, album, {
    poll,
    webPage,
    hasSubheader,
    isCustomShape,
    isLastInGroup,
    asForwarded,
    hasThread: hasThread && !noComments,
    forceSenderName,
    hasCommentCounter: hasThread && repliesThreadInfo.messagesCount > 0,
    hasBottomCommentButton: withCommentButton && !isCustomShape,
    hasActionButton: canForward || canFocus || (withCommentButton && isCustomShape),
    hasReactions,
    isGeoLiveActive: location?.mediaType === 'geoLive' && !isGeoLiveExpired(message),
    withVoiceTranscription,
    peerColorClass,
    hasOutsideReactions,
  });

  const withAppendix = contentClassName.includes('has-appendix');
  const emojiSize = getCustomEmojiSize(text?.emojiOnlyCount);

  const paidMessageStarsInMeta = !isChatWithUser
    ? (isAlbum && paidMessageStars ? album.messages.length * paidMessageStars : paidMessageStars)
    : undefined;

  let metaPosition!: MetaPosition;
  if (phoneCall) {
    metaPosition = 'none';
  } else if (isInDocumentGroupNotLast) {
    metaPosition = 'none';
  } else if (hasText && !webPage && !emojiSize && !isInvertedMedia) {
    metaPosition = 'in-text';
  } else if (isInvertedMedia && !emojiSize && (hasFactCheck || webPage)) {
    metaPosition = 'in-text';
  } else {
    metaPosition = 'standalone';
  }

  let reactionsPosition!: ReactionsPosition;
  if (hasReactions) {
    if (hasOutsideReactions) {
      reactionsPosition = 'outside';
    } else if (asForwarded) {
      metaPosition = 'standalone';
      reactionsPosition = 'inside';
    } else {
      reactionsPosition = 'inside';
    }
  } else {
    reactionsPosition = 'none';
  }

  const quickReactionPosition: QuickReactionPosition = isCustomShape ? 'in-meta' : 'in-content';

  useEnsureMessage(
    replyToPeerId || chatId,
    replyToMsgId,
    replyMessage,
    message.id,
    shouldHideReply || isReplyPrivate,
  );

  useEnsureStory(
    storyReplyPeerId || chatId,
    storyReplyId,
    replyStory,
  );

  useFocusMessageListElement({
    elementRef: ref,
    isFocused,
    focusDirection,
    noFocusHighlight,
    isResizingContainer,
    isJustAdded,
    isQuote: Boolean(focusedQuote),
    scrollTargetPosition,
  });

  const viaBusinessBotTitle = viaBusinessBot ? getPeerFullTitle(oldLang, viaBusinessBot) : undefined;

  const canShowPostAuthor = !message.senderId;
  const signature = viaBusinessBotTitle || (canShowPostAuthor && message.postAuthorTitle)
    || ((asForwarded || isChatWithSelf) && forwardInfo?.postAuthorTitle)
    || undefined;

  useEffect(() => {
    const bottomMarker = bottomMarkerRef.current;
    if (!bottomMarker || !isElementInViewport(bottomMarker)) return;

    if (hasUnreadReaction) {
      animateUnreadReaction({ messageIds: [messageId] });
    }

    let unreadMentionIds: number[] = [];
    if (message.hasUnreadMention) {
      unreadMentionIds = [messageId];
    }

    if (album) {
      unreadMentionIds = album.messages.filter((msg) => msg.hasUnreadMention).map((msg) => msg.id);
    }

    if (unreadMentionIds.length) {
      markMentionsRead({ chatId, messageIds: unreadMentionIds });
    }
  }, [hasUnreadReaction, album, chatId, messageId, animateUnreadReaction, message.hasUnreadMention]);

  const albumLayout = useMemo(() => {
    return isAlbum
      ? calculateAlbumLayout(isOwn, Boolean(noAvatars), album, isMobile)
      : undefined;
  }, [isAlbum, isOwn, noAvatars, album, isMobile]);

  const extraPadding = asForwarded && !isCustomShape ? 28 : 0;

  const sizeCalculations = useMemo(() => {
    let calculatedWidth;
    let contentWidth: number | undefined;
    let style = '';
    let reactionsMaxWidth;

    if (!isAlbum && (photo || video || invoice?.extendedMedia)) {
      let width: number | undefined;
      if (photo || video) {
        const media = (photo || video);
        if (media && !isRoundVideo) {
          width = calculateMediaDimensions({
            media,
            isOwn,
            asForwarded,
            noAvatars,
            isMobile,
          }).width;
        }
      } else if (invoice?.extendedMedia && (
        invoice.extendedMedia.width && invoice.extendedMedia.height
      )) {
        const { width: previewWidth, height: previewHeight } = invoice.extendedMedia;
        width = calculateDimensionsForMessageMedia({
          width: previewWidth,
          height: previewHeight,
          fromOwnMessage: isOwn,
          asForwarded,
          noAvatars,
          isMobile,
        }).width;
      }

      if (width) {
        if (width < getMinMediaWidthWithText(isMobile)) {
          contentWidth = width;
        }
        calculatedWidth = Math.max(getMinMediaWidth(text?.text, isMobile, isMediaWithCommentButton), width);
      }
    } else if (albumLayout) {
      const minWidth = getMinMediaWidth(text?.text, isMobile, isMediaWithCommentButton);
      calculatedWidth = Math.max(minWidth, albumLayout.containerStyle.width);
    }

    if (calculatedWidth) {
      style = `width: ${calculatedWidth}px`;
      reactionsMaxWidth = calculatedWidth + EXTRA_SPACE_FOR_REACTIONS;
    } else if (sticker && !hasSubheader) {
      const { width } = getStickerDimensions(sticker, isMobile);
      style = `width: ${width + extraPadding}px`;
      reactionsMaxWidth = width + EXTRA_SPACE_FOR_REACTIONS;
    }

    return {
      contentWidth, style, reactionsMaxWidth,
    };
  }, [
    albumLayout, asForwarded, extraPadding, hasSubheader, invoice?.extendedMedia, isAlbum, isMediaWithCommentButton,
    isMobile, isOwn, noAvatars, photo, sticker, text?.text, video, isRoundVideo,
  ]);

  const {
    contentWidth, style: sizeStyles, reactionsMaxWidth,
  } = sizeCalculations;

  const contentStyle = buildStyle(peerColorStyle, sizeStyles);

  function renderMessageText(isForAnimation?: boolean) {
    if (!textMessage) return undefined;

    const forcedText = (isShowingSummary && summary?.text)
      || (requestedTranslationLanguage ? currentTranslatedText : undefined);
    return (
      <MessageText
        messageOrStory={textMessage}
        forcedText={forcedText}
        isForAnimation={isForAnimation}
        focusedQuote={focusedQuote}
        focusedQuoteOffset={focusedQuoteOffset}
        emojiSize={emojiSize}
        highlight={highlight}
        isProtected={isProtected}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        withTranslucentThumbs={isCustomShape}
        isInSelectMode={isInSelectMode}
        canBeEmpty={hasFactCheck}
        maxTimestamp={maxTimestamp}
        threadId={threadId}
        shouldAnimateTyping={isTypingDraft}
      />
    );
  }

  function renderMessageTextAnimation() {
    return (
      <div className="translation-animation">
        <div className="text-loading">
          {renderMessageText(true)}
        </div>
      </div>
    );
  }

  const renderQuickReactionButton = useCallback(() => {
    if (!defaultReaction) return undefined;

    return (
      <div
        className={buildClassName(
          'quick-reaction',
          'no-selection',
          isQuickReactionVisible && !hasActiveReactions && 'visible',
        )}
        onClick={handleSendQuickReaction}
        ref={quickReactionRef}
      >
        <ReactionStaticEmoji
          reaction={defaultReaction}
          size={QUICK_REACTION_SIZE}
          availableReactions={availableReactions}
          observeIntersection={observeIntersectionForPlaying}
        />
      </div>
    );
  }, [
    hasActiveReactions, availableReactions, defaultReaction, handleSendQuickReaction, isQuickReactionVisible,
    observeIntersectionForPlaying,
  ]);

  function renderReactionsAndMeta() {
    const meta = (
      <MessageMeta
        message={message}
        isPinned={isPinned}
        withFullDate={isChatWithSelf && !isOwn}
        noReplies={noReplies}
        repliesThreadInfo={repliesThreadInfo}
        outgoingStatus={outgoingStatus}
        signature={signature}
        withReactionOffset={reactionsPosition === 'inside'}
        renderQuickReactionButton={
          withQuickReactionButton && quickReactionPosition === 'in-meta' ? renderQuickReactionButton : undefined
        }
        availableReactions={availableReactions}
        isTranslated={Boolean(requestedTranslationLanguage ? currentTranslatedText : undefined)}
        effectEmoji={effect?.emoticon}
        onClick={handleMetaClick}
        onEffectClick={handleEffectClick}
        onTranslationClick={handleTranslationClick}
        onOpenThread={handleOpenThread}
        paidMessageStars={paidMessageStarsInMeta}
      />
    );

    if (reactionsPosition !== 'inside') {
      return meta;
    }

    return (
      <Reactions
        message={reactionMessage!}
        threadId={threadId}
        metaChildren={meta}
        observeIntersection={observeIntersectionForPlaying}
        noRecentReactors={isChannel}
        tags={tags}
        isCurrentUserPremium={isPremium}
        isAccountFrozen={isAccountFrozen}
      />
    );
  }

  function renderContent() {
    const className = buildClassName(
      'content-inner',
      asForwarded && 'forwarded-message',
      hasForwardedCustomShape && 'forwarded-custom-shape',
      hasSubheader && 'with-subheader',
    );
    const hasCustomAppendix = isLastInGroup
      && (!hasText || (isInvertedMedia && !hasFactCheck && reactionsPosition !== 'inside')) && !withCommentButton;
    const textContentClass = buildClassName(
      'text-content',
      'clearfix',
      metaPosition === 'in-text' && 'with-meta',
      outgoingStatus && 'with-outgoing-icon',
    );
    const shouldReadMedia = !hasTtl || !isOwn || isChatWithSelf;

    return (
      <div className={className} onDoubleClick={handleContentDoubleClick} dir="auto">
        {!asForwarded && shouldRenderSenderName() && renderSenderName()}
        {hasSubheader && (
          <div className="message-subheader">
            {hasTopicChip && (
              <TopicChip
                topic={messageTopic}
                onClick={handleTopicChipClick}
                className="message-topic"
              />
            )}
            {hasForwardedCustomShape && (
              <div className="forward-custom-shape-subheader">
                <div className="message-title">
                  {renderForwardTitle()}
                </div>
                {renderSenderName(true, true)}
              </div>
            )}
            {hasMessageReply && (
              <EmbeddedMessage
                message={replyMessage}
                replyInfo={messageReplyInfo}
                noUserColors={noUserColors}
                isProtected={isProtected}
                sender={replyMessageSender}
                senderChat={replyMessageChat}
                forwardSender={replyMessageForwardSender}
                chatTranslations={chatTranslations}
                isMediaNsfw={isReplyMediaNsfw}
                requestedChatTranslationLanguage={requestedChatTranslationLanguage}
                observeIntersectionForLoading={observeIntersectionForLoading}
                observeIntersectionForPlaying={observeIntersectionForPlaying}
                onClick={handleReplyClick}
              />
            )}
            {hasStoryReply && (
              <EmbeddedStory
                story={replyStory}
                sender={storySender}
                noUserColors={noUserColors}
                isProtected={isProtected}
                observeIntersectionForLoading={observeIntersectionForLoading}
                onClick={handleStoryClick}
              />
            )}
            {hasSummary && isShowingSummary && !summary?.isPending && (
              <PeerColorWrapper
                className="message-summary"
                onClick={hideSummary}
              >
                <Sparkles preset="button" className="message-summary-sparkles" />
                <span className="message-summary-title">
                  {lang('MessageSummaryTitle')}
                </span>
                <span className="message-summary-description">
                  {lang('MessageSummaryDescription')}
                </span>
              </PeerColorWrapper>
            )}
          </div>
        )}
        {sticker && observeIntersectionForLoading && observeIntersectionForPlaying && (
          <Sticker
            message={message}
            observeIntersection={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            shouldLoop={shouldLoopStickers}
            shouldPlayEffect={shouldPlayEffect}
            withEffect={withAnimatedEffects}
            isMediaNsfw={isMediaNsfw}
            onStopEffect={hideEffect}
          />
        )}
        {hasAnimatedEmoji && animatedCustomEmoji && (
          <AnimatedCustomEmoji
            customEmojiId={animatedCustomEmoji}
            withEffects={withAnimatedEffects && isChatWithUser && !effect}
            isOwn={isOwn}
            observeIntersection={observeIntersectionForLoading}
            forceLoadPreview={isLocal}
            messageId={messageId}
            chatId={chatId}
            activeEmojiInteractions={activeEmojiInteractions}
          />
        )}
        {hasAnimatedEmoji && animatedEmoji && (
          <AnimatedEmoji
            emoji={animatedEmoji}
            withEffects={withAnimatedEffects && isChatWithUser && !effect}
            isOwn={isOwn}
            observeIntersection={observeIntersectionForLoading}
            forceLoadPreview={isLocal}
            messageId={messageId}
            chatId={chatId}
            activeEmojiInteractions={activeEmojiInteractions}
          />
        )}
        {withAnimatedEffects && effect && !isLocal && (
          <MessageEffect
            shouldPlay={shouldPlayEffect}
            messageId={message.id}
            isMirrored={!message.isOutgoing}
            effect={effect}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            onStop={hideEffect}
          />
        )}
        {phoneCall && (
          <MessagePhoneCall
            message={message}
            phoneCall={phoneCall}
            chatId={chatId}
          />
        )}
        {!isAlbum && isRoundVideo && !withVoiceTranscription && (
          <RoundVideo
            message={message}
            observeIntersection={observeIntersectionForLoading}
            canAutoLoad={canAutoLoadMedia}
            isDownloading={isDownloading}
            onReadMedia={shouldReadMedia ? handleReadMedia : undefined}
            onHideTranscription={setTranscriptionHidden}
            isTranscriptionError={isTranscriptionError}
            isTranscribed={Boolean(transcribedText)}
            canTranscribe={canTranscribeVoice && !hasTtl}
            isTranscriptionHidden={isTranscriptionHidden}
            isTranscribing={isTranscribing}
          />
        )}
        {(audio || voice || withVoiceTranscription) && (
          <Audio
            theme={theme}
            message={message}
            origin={AudioOrigin.Inline}
            uploadProgress={uploadProgress}
            isSelectable={isInDocumentGroup}
            isSelected={isSelected}
            noAvatars={noAvatars}
            onPlay={handleAudioPlay}
            onReadMedia={voice && shouldReadMedia ? handleReadMedia : undefined}
            onCancelUpload={handleCancelUpload}
            isDownloading={isDownloading}
            isTranscribing={isTranscribing}
            isTranscriptionHidden={isTranscriptionHidden}
            isTranscribed={Boolean(transcribedText)}
            isTranscriptionError={isTranscriptionError}
            canDownload={!isProtected}
            onHideTranscription={setTranscriptionHidden}
            canTranscribe={canTranscribeVoice && !hasTtl}
          />
        )}
        {document && (
          <Document
            document={document}
            message={message}
            observeIntersection={observeIntersectionForLoading}
            canAutoLoad={canAutoLoadMedia}
            autoLoadFileMaxSizeMb={autoLoadFileMaxSizeMb}
            uploadProgress={uploadProgress}
            isSelectable={isInDocumentGroup}
            isSelected={isSelected}
            onMediaClick={handleDocumentClick}
            onCancelUpload={handleCancelUpload}
            isDownloading={isDownloading}
            shouldWarnAboutFiles={shouldWarnAboutFiles}
          />
        )}
        {storyData && !isStoryMention && (
          <Story
            message={message}
            isProtected={isProtected}
          />
        )}
        {isStoryMention && <StoryMention message={message} />}
        {contact && (
          <Contact contact={contact} noUserColors={isOwn} />
        )}
        {poll && (
          <Poll message={message} poll={poll} onSendVote={handleVoteSend} />
        )}
        {todo && (
          <TodoList message={message} todoList={todo} />
        )}
        {(giveaway || giveawayResults) && (
          <Giveaway message={message} />
        )}
        {game && (
          <Game
            message={message}
            threadId={threadId}
            canAutoLoadMedia={canAutoLoadMedia}
          />
        )}
        {dice && (
          <DiceWrapper
            isLocal={isLocal}
            dice={dice}
            isOutgoing={isOwn}
            canPlayWinEffect={shouldPlayDiceEffect}
            onEffectPlayed={hideDiceEffect}
          />
        )}
        {invoice?.extendedMedia && (
          <InvoiceMediaPreview
            message={message}
            isConnected={isConnected}
          />
        )}

        {withVoiceTranscription && (
          <p
            className={buildClassName(
              'transcription',
              !isTranscriptionHidden && isTranscriptionError && 'transcription-error',
            )}
            dir="auto"
          >
            {(isTranscriptionError ? oldLang('NoWordsRecognized') : (
              isTranscribing && transcribedText ? <DotAnimation content={transcribedText} /> : transcribedText
            ))}
          </p>
        )}

        {isInvertedMedia && renderInvertedMediaContent(hasCustomAppendix)}

        {!isInvertedMedia && (
          <>
            {renderInvertibleMediaContent(hasCustomAppendix)}
            {hasText && !hasAnimatedEmoji && (
              <div className={textContentClass} dir="auto">
                {renderMessageText()}
                {isNewTextPending && renderMessageTextAnimation()}
                {hasFactCheck && (
                  <FactCheck factCheck={factCheck} isToggleDisabled={isInSelectMode} />
                )}
                {metaPosition === 'in-text' && renderReactionsAndMeta()}
              </div>
            )}
            {renderWebPage()}
          </>
        )}

        {invoice && !invoice.extendedMedia && (
          <Invoice
            message={message}
            shouldAffectAppendix={hasCustomAppendix && !hasReactions}
            isInSelectMode={isInSelectMode}
            isSelected={isSelected}
            theme={theme}
            forcedWidth={contentWidth}
          />
        )}
        {location && (
          <Location
            message={message}
            isInSelectMode={isInSelectMode}
            isSelected={isSelected}
            theme={theme}
            peer={sender}
          />
        )}
      </div>
    );
  }

  function renderInvertedMediaContent(hasCustomAppendix: boolean) {
    const textContentClass = buildClassName(
      'text-content',
      'clearfix',
    );
    const footerClass = buildClassName(
      'text-content',
      'clearfix',
      metaPosition === 'in-text' && 'with-meta',
      outgoingStatus && 'with-outgoing-icon',
    );

    const hasMediaAfterText = isAlbum || (!isAlbum && photo) || (!isAlbum && video && !isRoundVideo);
    const hasContentAfterText = hasMediaAfterText || (!hasAnimatedEmoji && hasFactCheck);
    const isMetaInText = metaPosition === 'in-text';

    return (
      <>
        {renderWebPage()}
        {hasText && !hasAnimatedEmoji && (
          <div className={textContentClass} dir="auto">
            {renderMessageText()}
            {isNewTextPending && renderMessageTextAnimation()}
            {!hasContentAfterText && isMetaInText && renderReactionsAndMeta()}
          </div>
        )}

        {hasContentAfterText && (
          <>
            {renderInvertibleMediaContent(hasCustomAppendix)}
            {!hasAnimatedEmoji && (
              <div className={footerClass} dir="auto">
                {hasFactCheck && (
                  <FactCheck factCheck={factCheck} isToggleDisabled={isInSelectMode} />
                )}
                {isMetaInText && renderReactionsAndMeta()}
              </div>
            )}
          </>
        )}

      </>
    );
  }

  function renderWebPage() {
    const messageWebPage = getMessageWebPage(message);
    if (!messageWebPage || !webPage) return undefined;
    return (
      <WebPage
        messageWebPage={messageWebPage}
        webPage={webPage}
        message={message}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        noAvatars={noAvatars}
        canAutoLoad={canAutoLoadMedia}
        canAutoPlay={canAutoPlayMedia}
        asForwarded={asForwarded}
        isDownloading={isDownloading}
        isProtected={isProtected}
        theme={theme}
        story={webPageStory}
        isConnected={isConnected}
        lastPlaybackTimestamp={lastPlaybackTimestamp}
        backgroundEmojiId={messageColorPeer?.color?.backgroundEmojiId}
        shouldWarnAboutFiles={shouldWarnAboutFiles}
        autoLoadFileMaxSizeMb={autoLoadFileMaxSizeMb}
        onAudioPlay={handleAudioPlay}
        onMediaClick={handleMediaClick}
        onDocumentClick={handleDocumentClick}
        onCancelMediaTransfer={handleCancelUpload}
      />
    );
  }

  function renderInvertibleMediaContent(hasCustomAppendix: boolean) {
    const content = (
      <>
        {isAlbum && observeIntersectionForLoading && (
          <Album
            album={album}
            albumLayout={albumLayout!}
            observeIntersection={observeIntersectionForLoading}
            isOwn={isOwn}
            isProtected={isProtected}
            hasCustomAppendix={hasCustomAppendix}
            onMediaClick={handleAlbumMediaClick}
          />
        )}
        {!isAlbum && photo && (
          <Photo
            messageText={text?.text}
            photo={photo}
            isOwn={isOwn}
            observeIntersection={observeIntersectionForLoading}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoadMedia}
            uploadProgress={uploadProgress}
            shouldAffectAppendix={hasCustomAppendix}
            isDownloading={isDownloading}
            isProtected={isProtected}
            asForwarded={asForwarded}
            theme={theme}
            isMediaNsfw={isMediaNsfw}
            forcedWidth={contentWidth}
            onClick={handlePhotoMediaClick}
            onCancelUpload={handleCancelUpload}
          />
        )}
        {!isAlbum && video && !isRoundVideo && (
          <Video
            video={video}
            isOwn={isOwn}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            forcedWidth={contentWidth}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoadMedia}
            canAutoPlay={canAutoPlayMedia}
            uploadProgress={uploadProgress}
            isDownloading={isDownloading}
            isProtected={isProtected}
            asForwarded={asForwarded}
            isMediaNsfw={isMediaNsfw}
            lastPlaybackTimestamp={lastPlaybackTimestamp}
            onClick={handleVideoMediaClick}
            onCancelUpload={handleCancelUpload}
          />
        )}
      </>
    );

    if (paidMedia) {
      return (
        <PaidMediaOverlay chatId={chatId} messageId={messageId} paidMedia={paidMedia} isOutgoing={isOwn}>
          {content}
        </PaidMediaOverlay>
      );
    }

    return content;
  }

  function shouldRenderSenderName() {
    const media = photo || video || location || paidMedia;
    return !(isCustomShape && !viaBotId) && (
      (withSenderName && (!media || hasTopicChip)) || asForwarded || viaBotId || forceSenderName
    ) && !isInDocumentGroupNotFirst && !(hasMessageReply && isCustomShape);
  }

  function renderForwardTitle() {
    return (
      <span className="forward-title-container">
        {asForwarded && (
          <Icon name={forwardInfo?.hiddenUserName ? 'forward' : 'share-filled'} />
        )}
        {asForwarded && (
          <span className="forward-title">
            {oldLang('ForwardedFrom')}
          </span>
        )}
      </span>
    );
  }

  const handleInlineButtonClick = useLastCallback((button: ApiKeyboardButton) => {
    clickBotInlineButton({
      chatId,
      messageId: message.id,
      threadId,
      button,
    });
  });

  const handleLocalInlineButtonClick = useLastCallback((button: ApiKeyboardButton) => {
    if (button.type === 'openThread') {
      openThread({
        chatId,
        threadId: messageTopic!.id,
      });
      return;
    }

    if (button.type === 'suggestedMessage') {
      if (button.buttonType === 'approve') {
        openSuggestedPostApprovalModal({
          chatId,
          messageId: message.id,
        });
        return;
      }

      if (button.buttonType === 'decline') {
        openDeclineDialog();
        return;
      }

      clickSuggestedMessageButton({
        chatId,
        messageId: message.id,
        button,
      });
      return;
    }
  });

  const handleDeclineReasonChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDeclineReason(e.target.value);
  });

  const handleDeclineConfirm = useLastCallback(() => {
    rejectSuggestedPost({
      chatId,
      messageId: message.id,
      rejectComment: declineReason.trim() || undefined,
    });
    closeDeclineDialog();
    setDeclineReason('');
  });

  function renderSenderName(
    shouldSkipRenderForwardTitle: boolean = false, shouldSkipRenderAdminTitle: boolean = false,
  ) {
    let senderTitle;
    let senderColor;
    if (senderPeer && !(isCustomShape && viaBotId)) {
      senderTitle = getPeerFullTitle(oldLang, senderPeer);
    } else if (forwardInfo?.hiddenUserName) {
      senderTitle = forwardInfo.hiddenUserName;
    } else if (storyData && originSender) {
      senderTitle = getPeerFullTitle(oldLang, originSender);
    }
    const senderEmojiStatus = senderPeer && 'emojiStatus' in senderPeer && senderPeer.emojiStatus;
    const senderIsPremium = senderPeer && 'isPremium' in senderPeer && senderPeer.isPremium;

    const shouldRenderForwardAvatar = asForwarded && senderPeer;
    const hasBotSenderUsername = botSender?.hasUsername;
    return (
      <div className="message-title" dir="ltr">
        {(senderTitle || asForwarded) ? (
          <span
            className={buildClassName(
              'message-title-name-container',
              forwardInfo?.hiddenUserName ? 'sender-hidden' : 'interactive',
              senderColor,
            )}
            dir="ltr"
          >
            {!shouldSkipRenderForwardTitle && renderForwardTitle()}
            <span className="message-title-name">
              {storyData && <Icon name="play-story" />}
              {shouldRenderForwardAvatar && (
                <Avatar
                  className="forward-avatar"
                  peer={senderPeer}
                  size="micro"
                />
              )}
              <span
                className="sender-title"
                onClick={handleSenderClick}
              >
                {senderTitle ? renderText(senderTitle) : (asForwarded ? NBSP : undefined)}
              </span>
              {!asForwarded && senderEmojiStatus && (
                <CustomEmoji
                  documentId={senderEmojiStatus.documentId}
                  className="no-selection"
                  loopLimit={EMOJI_STATUS_LOOP_LIMIT}
                  observeIntersectionForLoading={observeIntersectionForLoading}
                  observeIntersectionForPlaying={observeIntersectionForPlaying}
                />
              )}
              {!asForwarded && !senderEmojiStatus && senderIsPremium && <StarIcon />}
              {senderPeer?.fakeType && <FakeIcon fakeType={senderPeer.fakeType} />}
            </span>
          </span>
        ) : !botSender ? (
          NBSP
        ) : undefined}
        {botSender?.hasUsername && (
          <span className="interactive">
            <span className="via">{oldLang('ViaBot')}</span>
            <span
              className="sender-title"
              onClick={handleViaBotClick}
            >
              {renderText(`@${getMainUsername(botSender)}`)}
            </span>
          </span>
        )}
        <div className="title-spacer" />
        {!shouldSkipRenderAdminTitle && !hasBotSenderUsername ? (forwardInfo?.isLinkedChannelPost ? (
          <span className="admin-title" dir="auto">{oldLang('DiscussChannel')}</span>
        ) : message.postAuthorTitle && isGroup && !asForwarded ? (
          <span className="admin-title" dir="auto">{message.postAuthorTitle}</span>
        ) : senderAdminMember && !asForwarded && !viaBotId ? (
          <span className="admin-title" dir="auto">
            {senderAdminMember.customTitle || oldLang(
              senderAdminMember.isOwner ? 'GroupInfo.LabelOwner' : 'GroupInfo.LabelAdmin',
            )}
          </span>
        ) : undefined) : undefined}
        {canShowSenderBoosts && (
          <span className="sender-boosts" aria-hidden>
            <Icon name={senderBoosts > 1 ? 'boosts' : 'boost'} />
            {senderBoosts > 1 ? senderBoosts : undefined}
          </span>
        )}
      </div>
    );
  }

  const forwardAuthor = isGroup && asForwarded ? message.postAuthorTitle : undefined;
  const shouldRenderSuggestedPostButtons = message.suggestedPostInfo
    && !message.isOutgoing && !message.suggestedPostInfo.isAccepted && !message.suggestedPostInfo.isRejected;

  const isSuggestedPostExpired = (() => {
    if (!message.suggestedPostInfo?.scheduleDate || !minFutureTime) return false;
    const now = getServerTime();
    return message.suggestedPostInfo.scheduleDate <= now + minFutureTime;
  })();

  const suggestedPostButtons: ApiKeyboardButton[][] | undefined = useMemo(() => {
    if (!shouldRenderSuggestedPostButtons) return undefined;
    return [
      [
        {
          type: 'suggestedMessage',
          buttonType: 'decline',
          text: lang('SuggestedPostDecline'),
        },
        {
          type: 'suggestedMessage',
          buttonType: 'approve',
          text: lang('SuggestedPostApprove'),
          disabled: isSuggestedPostExpired,
        },
      ],
      [
        {
          type: 'suggestedMessage',
          buttonType: 'suggestChanges',
          text: lang('SuggestedPostSuggestChanges'),
        },
      ],
    ];
  }, [isSuggestedPostExpired, lang, shouldRenderSuggestedPostButtons]);

  const openThreadButtons: ApiKeyboardButton[][] | undefined = useMemo(() => {
    if (!isBotForum || message.inlineButtons || !messageTopic || !isLastInList ||
      threadId !== MAIN_THREAD_ID
    ) return undefined;

    return [
      [{
        type: 'openThread',
        text: lang('BotForumContinueThreadButton'),
      }],
    ];
  }, [isBotForum, lang, message.inlineButtons, messageTopic, isLastInList, threadId]);

  const additionalInlineButtons = suggestedPostButtons || openThreadButtons;

  return (
    <div
      ref={ref}
      id={getMessageHtmlId(message.id)}
      className={containerClassName}
      data-message-id={messageId}
      onCopy={isProtected ? stopEvent : undefined}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={isInDocumentGroupNotLast ? handleDocumentGroupMouseEnter : undefined}
      onMouseMove={withQuickReactionButton ? handleMouseMove : undefined}
      onMouseLeave={(withQuickReactionButton || isInDocumentGroupNotLast) ? handleMouseLeave : undefined}
    >
      <div
        ref={bottomMarkerRef}
        className="bottom-marker"
        data-message-id={messageId}
        data-last-message-id={album ? album.messages[album.messages.length - 1].id : undefined}
        data-album-main-id={album ? album.mainMessage.id : undefined}
        data-has-unread-mention={message.hasUnreadMention || undefined}
        data-has-unread-reaction={hasUnreadReaction || undefined}
        data-is-pinned={isPinned || undefined}
        data-should-update-views={message.viewsCount !== undefined}
      />
      {!isInDocumentGroup && (
        <div className="message-select-control no-selection">
          {isSelected && <Icon name="select" />}
        </div>
      )}
      {isLastInDocumentGroup && (
        <div
          className={buildClassName(
            'message-select-control group-select no-selection', isGroupSelected && 'is-selected',
          )}
          onClick={handleDocumentGroupSelectAll}
        >
          {isGroupSelected && (
            <Icon name="select" />
          )}
        </div>
      )}
      <div
        className={buildClassName('message-content-wrapper',
          contentClassName.includes('text') && 'can-select-text',
          contentClassName.includes('giveaway') && 'giveaway-result-content')}
      >
        <div
          className={contentClassName}
          style={contentStyle}
          dir="auto"
        >
          {asForwarded && !isInDocumentGroupNotFirst && (
            <>
              {shouldRenderSenderName() && renderSenderName()}
              {forwardAuthor && <span className="admin-title" dir="auto">{forwardAuthor}</span>}
            </>
          )}
          {renderContent()}
          {!isInDocumentGroupNotLast && metaPosition === 'standalone' && !isStoryMention && renderReactionsAndMeta()}
          {canShowActionButton && (
            <div className="message-action-buttons-container">
              <div className="message-action-buttons-sticky-zone">
                <div className="message-action-buttons message-action-button-sticky">
                  {hasSummary && (
                    <Button
                      className="message-action-button action-summary"
                      color="translucent-white"
                      round
                      withSparkleEffect
                      ariaLabel={isShowingSummary ? lang('AriaHideSummary') : lang('AriaShowSummary')}
                      onClick={isShowingSummary ? hideSummary : showSummary}
                      iconName={isShowingSummary ? 'expand' : 'collapse'}
                    />
                  )}
                </div>
              </div>
              <div className={buildClassName(
                'message-action-buttons',
                isLoadingComments && 'message-action-buttons-shown',
              )}
              >
                {withCommentButton && isCustomShape && (
                  <CommentButton
                    threadInfo={commentsThreadInfo}
                    disabled={noComments || !commentsThreadInfo}
                    isLoading={isLoadingComments}
                    isCustomShape
                    asActionButton
                  />
                )}
                {canForward && (
                  <Button
                    className="message-action-button"
                    color="translucent-white"
                    round
                    ariaLabel={oldLang('lng_context_forward_msg')}
                    onClick={isLastInDocumentGroup ? handleGroupForward : handleForward}
                    iconName="share-filled"
                  />
                )}
                {canFocus && (
                  <Button
                    className="message-action-button"
                    color="translucent-white"
                    round
                    ariaLabel={lang('FocusMessage')}
                    onClick={isPinnedList ? handleFocus : handleFocusForwarded}
                    iconName="arrow-right"
                  />
                )}
              </div>
            </div>
          )}
          {withCommentButton && !isCustomShape && (
            <CommentButton
              threadInfo={commentsThreadInfo}
              disabled={noComments || !commentsThreadInfo}
              isLoading={isLoadingComments}
            />
          )}
          {withAppendix && <MessageAppendix isOwn={isOwn} />}
          {withQuickReactionButton && quickReactionPosition === 'in-content' && renderQuickReactionButton()}
        </div>
        {message.inlineButtons && (
          <InlineButtons inlineButtons={message.inlineButtons} onClick={handleInlineButtonClick} />
        )}
        {additionalInlineButtons && (
          <InlineButtons
            inlineButtons={additionalInlineButtons}
            onClick={handleLocalInlineButtonClick}
          />
        )}
        {reactionsPosition === 'outside' && !isStoryMention && (
          <Reactions
            message={reactionMessage!}
            threadId={threadId}
            isOutside
            isCurrentUserPremium={isPremium}
            maxWidth={reactionsMaxWidth}
            observeIntersection={observeIntersectionForPlaying}
            noRecentReactors={isChannel}
            tags={tags}
            isAccountFrozen={isAccountFrozen}
          />
        )}
      </div>
      {contextMenuAnchor && (
        <ContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          targetHref={contextMenuTarget?.matches('a[href]') ? (contextMenuTarget as HTMLAnchorElement).href : undefined}
          message={message}
          album={album}
          messageListType={messageListType}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          repliesThreadInfo={repliesThreadInfo}
          noReplies={noReplies}
          detectedLanguage={detectedLanguage}
        />
      )}
      {isDeclineDialogOpen && (
        <ConfirmDialog
          isOpen={isDeclineDialogOpen}
          onClose={closeDeclineDialog}
          title={lang('SuggestedPostDecline')}
          confirmLabel={lang('SuggestedPostDecline')}
          confirmHandler={handleDeclineConfirm}
          confirmIsDestructive
        >
          <div className="decline-dialog-question">
            {renderText(lang('DeclinePostDialogQuestion', {
              sender: sender ? getPeerFullTitle(oldLang, sender) : '',
            }, { withNodes: true, withMarkdown: true }))}
          </div>
          <InputText
            placeholder={lang('DeclineReasonPlaceholder')}
            value={declineReason}
            onChange={handleDeclineReasonChange}
            maxLength={MAX_REASON_LENGTH}
          />
        </ConfirmDialog>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, ownProps): Complete<StateProps> => {
    const {
      focusedMessage, forwardMessages, activeReactions, activeEmojiInteractions,
      loadingThread,
    } = selectTabState(global);
    const {
      message, album, withSenderName, withAvatar, threadId, messageListType, isLastInDocumentGroup, isFirstInGroup,
    } = ownProps;
    const {
      id, chatId, viaBotId, isOutgoing, forwardInfo, transcriptionId, isPinned, viaBusinessBotId, effectId,
      paidMessageStars,
    } = message;

    const webPage = selectFullWebPageFromMessage(global, message);

    const { shouldWarnAboutFiles } = selectSharedSettings(global);
    const isChatWithUser = isUserId(chatId);

    const chat = selectChat(global, chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isSystemBotChat = isSystemBot(chatId);
    const isAnonymousForwards = isAnonymousForwardsChat(chatId);
    const isChannel = chat && isChatChannel(chat);
    const isGroup = chat && isChatGroup(chat);
    const chatFullInfo = !isChatWithUser ? selectChatFullInfo(global, chatId) : undefined;
    const webPageStoryData = webPage?.story;
    const webPageStory = webPageStoryData
      ? selectPeerStory(global, webPageStoryData.peerId, webPageStoryData.id)
      : undefined;

    const isForwarding = forwardMessages.messageIds && forwardMessages.messageIds.includes(id);
    const forceSenderName = !isChatWithSelf && isAnonymousOwnMessage(message);
    const canShowSender = withSenderName || withAvatar || forceSenderName;
    const sender = selectSender(global, message);
    const originSender = selectForwardedSender(global, message);
    const botSender = viaBotId ? selectUser(global, viaBotId) : undefined;
    const senderAdminMember = sender?.id && isGroup
      ? chatFullInfo?.adminMembersById?.[sender?.id]
      : undefined;

    const isThreadTop = message.id === threadId;

    const { replyToMsgId, replyToPeerId, replyFrom } = getMessageReplyInfo(message) || {};
    const { peerId: storyReplyPeerId, storyId: storyReplyId } = getStoryReplyInfo(message) || {};

    const shouldHideReply = replyToMsgId && replyToMsgId === threadId;
    const replyMessage = selectReplyMessage(global, message);
    const forwardHeader = forwardInfo || replyFrom;
    const replyMessageSender = replyMessage ? selectSender(global, replyMessage)
      : forwardHeader && !isSystemBotChat && !isAnonymousForwards
        ? selectSenderFromHeader(global, forwardHeader) : undefined;
    const replyMessageForwardSender = replyMessage && selectForwardedSender(global, replyMessage);
    const replyMessageChat = replyToPeerId ? selectChat(global, replyToPeerId) : undefined;
    const isReplyPrivate = !isSystemBotChat && !isAnonymousForwards && replyMessageChat
      && !isChatPublic(replyMessageChat)
      && (replyMessageChat.isNotJoined || selectIsChatRestricted(global, replyMessageChat.id));
    const isReplyToTopicStart = replyMessage?.content.action?.type === 'topicCreate';
    const replyStory = storyReplyId && storyReplyPeerId
      ? selectPeerStory(global, storyReplyPeerId, storyReplyId)
      : undefined;
    const storySender = storyReplyPeerId ? selectPeer(global, storyReplyPeerId) : undefined;

    const uploadProgress = selectUploadProgress(global, message);
    const isFocused = messageListType === 'thread' && (
      album
        ? album.messages.some((m) => selectIsMessageFocused(global, m, threadId))
        : selectIsMessageFocused(global, message, threadId)
    );

    const {
      direction: focusDirection, noHighlight: noFocusHighlight, isResizingContainer,
      quote: focusedQuote, quoteOffset: focusedQuoteOffset, scrollTargetPosition,
    } = (isFocused && focusedMessage) || {};

    const middleSearch = selectCurrentMiddleSearch(global);
    const highlight = middleSearch?.results?.query
      && `${middleSearch.isHashtag ? '#' : ''}${middleSearch.results.query}`;

    const singleEmoji = getMessageSingleRegularEmoji(message);
    const animatedEmoji = singleEmoji && selectAnimatedEmoji(global, singleEmoji) ? singleEmoji : undefined;
    const animatedCustomEmoji = getMessageSingleCustomEmoji(message);

    let isSelected: boolean;
    if (album?.messages) {
      isSelected = album.messages.every(({ id: messageId }) => selectIsMessageSelected(global, messageId));
    } else {
      isSelected = selectIsMessageSelected(global, id);
    }

    const canReply = messageListType === 'thread' && selectCanReplyToMessage(global, message, threadId);
    const activeDownloads = selectActiveDownloads(global);
    const downloadableMedia = selectMessageDownloadableMedia(global, message);
    const isDownloading = downloadableMedia && getIsDownloading(activeDownloads, downloadableMedia);

    const repliesThreadInfo = selectThreadInfo(global, chatId, album?.commentsMessage?.id || id);

    const isInDocumentGroup = Boolean(message.groupedId) && !message.isInAlbum;
    const documentGroupFirstMessageId = isInDocumentGroup
      ? selectMessageIdsByGroupId(global, chatId, message.groupedId!)![0]
      : undefined;
    const reactionMessage = isInDocumentGroup ? (
      isLastInDocumentGroup ? selectChatMessage(global, chatId, documentGroupFirstMessageId!) : undefined
    ) : message;

    const hasUnreadReaction = chat?.unreadReactions?.includes(message.id);

    const hasTopicChip = threadId === MAIN_THREAD_ID && chat?.isForum && !chat.isBotForum && isFirstInGroup;
    const messageTopic = selectTopicFromMessage(global, message);

    const chatTranslations = selectChatTranslations(global, chatId);

    const requestedTranslationLanguage = selectRequestedMessageTranslationLanguage(global, chatId, message.id);
    const requestedChatTranslationLanguage = selectRequestedChatTranslationLanguage(global, chatId);

    const areTranslationsEnabled = IS_TRANSLATION_SUPPORTED && global.settings.byKey.canTranslate
      && !requestedChatTranslationLanguage; // Stop separate language detection if chat translation is requested

    const isConnected = global.connectionState === 'connectionStateReady';

    const hasActiveReactions = Boolean(reactionMessage && activeReactions[getMessageKey(reactionMessage)]?.length);

    const isPremium = selectIsCurrentUserPremium(global);
    const senderBoosts = sender && selectIsChatWithSelf(global, sender.id)
      ? (chatFullInfo?.boostsApplied ?? message.senderBoosts) : message.senderBoosts;

    const chatLevel = chat?.boostLevel || 0;
    const transcribeMinLevel = global.appConfig.groupTranscribeLevelMin;
    const canTranscribeVoice = isPremium || Boolean(transcribeMinLevel && chatLevel >= transcribeMinLevel);

    const viaBusinessBot = viaBusinessBotId ? selectUser(global, viaBusinessBotId) : undefined;

    const effect = effectId ? global.availableEffectById[effectId] : undefined;

    const poll = selectPollFromMessage(global, message);

    const maxTimestamp = selectMessageTimestampableDuration(global, message);

    const lastPlaybackTimestamp = selectMessageLastPlaybackTimestamp(global, chatId, message.id);
    const isAccountFrozen = selectIsCurrentUserFrozen(global);

    const minFutureTime = global.appConfig.starsSuggestedPostFutureMin;

    const isMediaNsfw = selectIsMediaNsfw(global, message);
    const isReplyMediaNsfw = replyMessage && selectIsMediaNsfw(global, replyMessage);

    const summary = selectMessageSummary(global, chatId, message.id, requestedTranslationLanguage);

    return {
      theme: selectTheme(global),
      forceSenderName,
      sender,
      canShowSender,
      originSender,
      botSender,
      shouldHideReply: shouldHideReply || isReplyToTopicStart,
      isThreadTop,
      replyMessage,
      replyMessageSender,
      replyMessageForwardSender,
      replyMessageChat,
      replyStory,
      isReplyPrivate,
      storySender,
      isInDocumentGroup,
      isProtected: selectIsMessageProtected(global, message),
      isChatProtected: selectIsChatProtected(global, chatId),
      isFocused,
      isForwarding,
      reactionMessage,
      isChatWithSelf,
      isBotForum: chat?.isBotForum,
      isRepliesChat: isSystemBotChat,
      isAnonymousForwards,
      isChannel,
      isGroup,
      canReply,
      highlight,
      animatedEmoji,
      animatedCustomEmoji,
      isInSelectMode: selectIsInSelectMode(global),
      isSelected,
      isGroupSelected: (
        Boolean(message.groupedId)
        && !message.isInAlbum
        && selectIsDocumentGroupSelected(global, chatId, message.groupedId)
      ),
      threadId,
      isDownloading,
      isPinnedList: messageListType === 'pinned',
      isPinned,
      canAutoLoadMedia: selectCanAutoLoadMedia(global, message),
      canAutoPlayMedia: selectCanAutoPlayMedia(global, message),
      autoLoadFileMaxSizeMb: global.settings.byKey.autoLoadFileMaxSizeMb,
      shouldLoopStickers: selectShouldLoopStickers(global),
      repliesThreadInfo,
      availableReactions: global.reactions.availableReactions,
      defaultReaction: isMessageLocal(message) || messageListType === 'scheduled'
        ? undefined : selectDefaultReaction(global, chatId),
      hasActiveReactions,
      activeEmojiInteractions,
      hasUnreadReaction,
      isTranscribing: transcriptionId !== undefined && global.transcriptions[transcriptionId]?.isPending,
      transcribedText: transcriptionId !== undefined ? global.transcriptions[transcriptionId]?.text : undefined,
      isPremium,
      senderAdminMember,
      messageTopic,
      hasTopicChip,
      chatTranslations,
      areTranslationsEnabled,
      shouldDetectChatLanguage: selectShouldDetectChatLanguage(global, chatId),
      requestedTranslationLanguage,
      requestedChatTranslationLanguage,
      hasLinkedChat: Boolean(chatFullInfo?.linkedChatId),
      withAnimatedEffects: selectPerformanceSettingsValue(global, 'stickerEffects'),
      webPageStory,
      isConnected,
      isLoadingComments: repliesThreadInfo?.isCommentsInfo
        && loadingThread?.loadingChatId === repliesThreadInfo?.originChannelId
        && loadingThread?.loadingMessageId === repliesThreadInfo?.originMessageId,
      shouldWarnAboutFiles,
      outgoingStatus: isOutgoing ? selectOutgoingStatus(global, message, messageListType === 'scheduled') : undefined,
      uploadProgress: typeof uploadProgress === 'number' ? uploadProgress : undefined,
      focusDirection: isFocused ? focusDirection : undefined,
      noFocusHighlight: isFocused ? noFocusHighlight : undefined,
      isResizingContainer: isFocused ? isResizingContainer : undefined,
      focusedQuote: isFocused ? focusedQuote : undefined,
      focusedQuoteOffset: isFocused ? focusedQuoteOffset : undefined,
      scrollTargetPosition: isFocused ? scrollTargetPosition : undefined,
      senderBoosts,
      tags: global.savedReactionTags?.byKey,
      canTranscribeVoice,
      viaBusinessBot,
      minFutureTime,
      effect,
      poll,
      maxTimestamp,
      lastPlaybackTimestamp,
      paidMessageStars,
      isChatWithUser,
      isAccountFrozen,
      isMediaNsfw,
      isReplyMediaNsfw,
      webPage,
      summary,
    };
  },
)(Message));
