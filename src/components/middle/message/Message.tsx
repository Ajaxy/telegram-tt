import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiAvailableReaction,
  ApiChat,
  ApiChatMember,
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiPeer,
  ApiReaction,
  ApiThreadInfo,
  ApiTopic,
  ApiTypeStory,
  ApiUser,
} from '../../../api/types';
import type {
  ActiveEmojiInteraction,
  ChatTranslatedMessages,
  MessageListType,
} from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { FocusDirection, IAlbum, ISettings } from '../../../types';
import type { Signal } from '../../../util/signals';
import type { PinnedIntersectionChangedCallback } from '../hooks/usePinnedMessage';
import { MAIN_THREAD_ID } from '../../../api/types';
import { AudioOrigin } from '../../../types';

import { EMOJI_STATUS_LOOP_LIMIT, GENERAL_TOPIC_ID } from '../../../config';
import {
  areReactionsEmpty,
  getMessageContent,
  getMessageCustomShape,
  getMessageHtmlId,
  getMessageKey,
  getMessageSingleCustomEmoji,
  getMessageSingleRegularEmoji,
  getSenderTitle,
  hasMessageText,
  isAnonymousOwnMessage,
  isChatChannel,
  isChatGroup,
  isChatPublic,
  isChatWithRepliesBot,
  isGeoLiveExpired,
  isMessageLocal,
  isMessageTranslatable,
  isOwnMessage,
  isReplyToMessage,
  isUserId,
} from '../../../global/helpers';
import { getMessageReplyInfo, getStoryReplyInfo } from '../../../global/helpers/replies';
import {
  selectAllowedMessageActions,
  selectAnimatedEmoji,
  selectCanAutoLoadMedia,
  selectCanAutoPlayMedia,
  selectChat,
  selectChatFullInfo,
  selectChatMessage,
  selectChatTranslations,
  selectCurrentTextSearch,
  selectDefaultReaction,
  selectForwardedSender,
  selectIsChatProtected,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectIsDocumentGroupSelected,
  selectIsDownloading,
  selectIsInSelectMode,
  selectIsMessageFocused,
  selectIsMessageProtected,
  selectIsMessageSelected,
  selectMessageIdsByGroupId,
  selectOutgoingStatus,
  selectPeerStory,
  selectPerformanceSettingsValue,
  selectReplySender,
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
import { isAnimatingScroll } from '../../../util/animateScroll';
import buildClassName from '../../../util/buildClassName';
import { isElementInViewport } from '../../../util/isElementInViewport';
import stopEvent from '../../../util/stopEvent';
import { IS_ANDROID, IS_ELECTRON, IS_TRANSLATION_SUPPORTED } from '../../../util/windowEnvironment';
import {
  calculateDimensionsForMessageMedia,
  getStickerDimensions,
  REM,
  ROUND_VIDEO_DIMENSIONS_PX,
} from '../../common/helpers/mediaDimensions';
import { getPeerColorClass } from '../../common/helpers/peerColor';
import renderText from '../../common/helpers/renderText';
import { getCustomEmojiSize } from '../composer/helpers/customEmoji';
import { buildContentClassName } from './helpers/buildContentClassName';
import { calculateAlbumLayout } from './helpers/calculateAlbumLayout';
import { calculateMediaDimensions, getMinMediaWidth, MIN_MEDIA_WIDTH_WITH_TEXT } from './helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import useEnsureStory from '../../../hooks/useEnsureStory';
import useFlag from '../../../hooks/useFlag';
import { dispatchHeavyAnimationEvent } from '../../../hooks/useHeavyAnimationCheck';
import { useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevious from '../../../hooks/usePrevious';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useShowTransition from '../../../hooks/useShowTransition';
import useTextLanguage from '../../../hooks/useTextLanguage';
import useThrottledCallback from '../../../hooks/useThrottledCallback';
import useAuthorWidth from '../hooks/useAuthorWidth';
import useDetectChatLanguage from './hooks/useDetectChatLanguage';
import useFocusMessage from './hooks/useFocusMessage';
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
import Icon from '../../common/Icon';
import MessageText from '../../common/MessageText';
import PremiumIcon from '../../common/PremiumIcon';
import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import TopicChip from '../../common/TopicChip';
import Button from '../../ui/Button';
import Album from './Album';
import AnimatedCustomEmoji from './AnimatedCustomEmoji';
import AnimatedEmoji from './AnimatedEmoji';
import CommentButton from './CommentButton';
import Contact from './Contact';
import ContextMenuContainer from './ContextMenuContainer.async';
import Game from './Game';
import Giveaway from './Giveaway';
import InlineButtons from './InlineButtons';
import Invoice from './Invoice';
import InvoiceMediaPreview from './InvoiceMediaPreview';
import Location from './Location';
import MessageAppendix from './MessageAppendix';
import MessageMeta from './MessageMeta';
import MessagePhoneCall from './MessagePhoneCall';
import Photo from './Photo';
import Poll from './Poll';
import Reactions from './Reactions';
import RoundVideo from './RoundVideo';
import Sticker from './Sticker';
import Story from './Story';
import StoryMention from './StoryMention';
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

type OwnProps =
  {
    message: ApiMessage;
    observeIntersectionForBottom: ObserveFn;
    observeIntersectionForLoading: ObserveFn;
    observeIntersectionForPlaying: ObserveFn;
    album?: IAlbum;
    noAvatars?: boolean;
    withAvatar?: boolean;
    withSenderName?: boolean;
    threadId: number;
    messageListType: MessageListType;
    noComments: boolean;
    noReplies: boolean;
    appearanceOrder: number;
    isJustAdded: boolean;
    memoFirstUnreadIdRef: { current: number | undefined };
    getIsMessageListReady: Signal<boolean>;
    onPinnedIntersectionChange: PinnedIntersectionChangedCallback;
  }
  & MessagePositionProperties;

type StateProps = {
  theme: ISettings['theme'];
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
  storySender?: ApiUser;
  outgoingStatus?: ApiMessageOutgoingStatus;
  uploadProgress?: number;
  isInDocumentGroup: boolean;
  isProtected?: boolean;
  isChatProtected?: boolean;
  isFocused?: boolean;
  focusDirection?: FocusDirection;
  focusedQuote?: string;
  noFocusHighlight?: boolean;
  isResizingContainer?: boolean;
  isForwarding?: boolean;
  isChatWithSelf?: boolean;
  isRepliesChat?: boolean;
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
  threadId?: number;
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
  isTranscriptionError?: boolean;
  isPremium: boolean;
  senderAdminMember?: ApiChatMember;
  messageTopic?: ApiTopic;
  hasTopicChip?: boolean;
  chatTranslations?: ChatTranslatedMessages;
  areTranslationsEnabled?: boolean;
  shouldDetectChatLanguage?: boolean;
  requestedTranslationLanguage?: string;
  requestedChatTranslationLanguage?: string;
  withStickerEffects?: boolean;
  webPageStory?: ApiTypeStory;
  isConnected: boolean;
  isLoadingComments?: boolean;
  shouldWarnAboutSvg?: boolean;
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
const APPEARANCE_DELAY = 10;
const NO_MEDIA_CORNERS_THRESHOLD = 18;
const QUICK_REACTION_SIZE = 1.75 * REM;
const EXTRA_SPACE_FOR_REACTIONS = 2.25 * REM;
const BOTTOM_FOCUS_SCROLL_THRESHOLD = 5;
const THROTTLE_MS = 300;
const RESIZE_ANIMATION_DURATION = 400;

const Message: FC<OwnProps & StateProps> = ({
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
  noFocusHighlight,
  isResizingContainer,
  isForwarding,
  isChatWithSelf,
  isRepliesChat,
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
  withStickerEffects,
  webPageStory,
  isConnected,
  getIsMessageListReady,
  shouldWarnAboutSvg,
  onPinnedIntersectionChange,
}) => {
  const {
    toggleMessageSelection,
    clickBotInlineButton,
    disableContextMenuHint,
    animateUnreadReaction,
    focusLastMessage,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const bottomMarkerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const quickReactionRef = useRef<HTMLDivElement>(null);

  const messageHeightRef = useRef(0);

  const lang = useLang();

  const [isTranscriptionHidden, setTranscriptionHidden] = useState(false);
  const [hasActiveStickerEffect, startStickerEffect, stopStickerEffect] = useFlag();
  const { isMobile, isTouchScreen } = useAppLayout();

  useOnIntersect(bottomMarkerRef, observeIntersectionForBottom);

  const {
    isContextMenuOpen,
    contextMenuPosition,
    contextMenuTarget,
    handleBeforeContextMenu,
    handleContextMenu: onContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(
    ref,
    isTouchScreen && isInSelectMode,
    !IS_ELECTRON,
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

    setTimeout(markShown, appearanceOrder * APPEARANCE_DELAY);
  }, [appearanceOrder, markShown, noAppearanceAnimation]);

  const { transitionClassNames } = useShowTransition(
    isShown || isJustAdded,
    undefined,
    noAppearanceAnimation && !isJustAdded,
    false,
  );

  const {
    id: messageId, chatId, forwardInfo, viaBotId, isTranscriptionError,
  } = message;

  useEffect(() => {
    if (!isPinned) return undefined;
    const id = album ? album.mainMessage.id : messageId;

    return () => {
      onPinnedIntersectionChange({ viewportPinnedIdsToRemove: [id], isUnmount: true });
    };
  }, [album, isPinned, messageId, onPinnedIntersectionChange]);

  const isLocal = isMessageLocal(message);
  const isOwn = isOwnMessage(message);
  const isScheduled = messageListType === 'scheduled' || message.isScheduled;
  const hasMessageReply = isReplyToMessage(message) && !shouldHideReply;

  const messageReplyInfo = getMessageReplyInfo(message);
  const storyReplyInfo = getStoryReplyInfo(message);

  const hasStoryReply = Boolean(storyReplyInfo);
  const hasThread = Boolean(repliesThreadInfo) && messageListType === 'thread';
  const isCustomShape = getMessageCustomShape(message);
  const hasAnimatedEmoji = isCustomShape && (animatedEmoji || animatedCustomEmoji);
  const hasReactions = reactionMessage?.reactions && !areReactionsEmpty(reactionMessage.reactions);
  const asForwarded = (
    forwardInfo
    && (!isChatWithSelf || isScheduled)
    && !isRepliesChat
    && !forwardInfo.isLinkedChannelPost
    && !isCustomShape
  ) || Boolean(message.content.storyData && !message.content.storyData.isMention);
  const isStoryMention = message.content.storyData?.isMention;
  const isAlbum = Boolean(album) && album!.messages.length > 1
    && !album?.messages.some((msg) => Object.keys(msg.content).length === 0);
  const isInDocumentGroupNotFirst = isInDocumentGroup && !isFirstInDocumentGroup;
  const isInDocumentGroupNotLast = isInDocumentGroup && !isLastInDocumentGroup;
  const isContextMenuShown = contextMenuPosition !== undefined;
  const canShowActionButton = (
    !(isContextMenuShown || isInSelectMode || isForwarding)
    && !isInDocumentGroupNotLast
    && !isStoryMention
  );
  const canForward = isChannel && !isScheduled && message.isForwardingAllowed && !isChatProtected;
  const canFocus = Boolean(isPinnedList
    || (forwardInfo
      && (forwardInfo.isChannelPost || (isChatWithSelf && !isOwn) || isRepliesChat)
      && forwardInfo.fromMessageId
    ));

  const noUserColors = isOwn && !isCustomShape;

  const hasSubheader = hasTopicChip || hasMessageReply || hasStoryReply;

  const selectMessage = useLastCallback((e?: React.MouseEvent<HTMLDivElement, MouseEvent>, groupedId?: string) => {
    toggleMessageSelection({
      messageId,
      groupedId,
      ...(e?.shiftKey && { withShift: true }),
      ...(isAlbum && { childMessageIds: album!.messages.map(({ id }) => id) }),
    });
  });

  const messageSender = canShowSender ? sender : undefined;
  const withVoiceTranscription = Boolean(!isTranscriptionHidden && (isTranscriptionError || transcribedText));

  const shouldPreferOriginSender = forwardInfo && (isChatWithSelf || isRepliesChat || !messageSender);
  const avatarPeer = shouldPreferOriginSender ? originSender : messageSender;
  const messageColorPeer = originSender || sender;
  const senderPeer = (forwardInfo || message.content.storyData) ? originSender : messageSender;
  const hasText = hasMessageText(message);

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
    handleAvatarClick,
    handleSenderClick,
    handleViaBotClick,
    handleReplyClick,
    handleMediaClick,
    handleAudioPlay,
    handleAlbumMediaClick,
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
  } = useInnerHandlers(
    lang,
    selectMessage,
    message,
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
    Boolean(requestedChatTranslationLanguage),
    replyStory && 'content' in replyStory ? replyStory : undefined,
    isReplyPrivate,
    isRepliesChat,
  );

  useEffect(() => {
    if (!isLastInList) {
      return;
    }

    if (withVoiceTranscription && transcribedText) {
      focusLastMessage();
    }
  }, [focusLastMessage, isLastInList, transcribedText, withVoiceTranscription]);

  const containerClassName = buildClassName(
    'Message message-list-item',
    isFirstInGroup && 'first-in-group',
    isProtected && !hasText ? 'is-protected' : 'allow-selection',
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
    message.isDeleting && 'is-deleting',
    isInDocumentGroup && 'is-in-document-group',
    isAlbum && 'is-album',
    message.hasUnreadMention && 'has-unread-mention',
    isSelected && 'is-selected',
    isInSelectMode && 'is-in-selection-mode',
    isThreadTop && !withAvatar && 'is-thread-top',
    Boolean(message.inlineButtons) && 'has-inline-buttons',
    isSwiped && 'is-swiped',
    transitionClassNames,
    isJustAdded && 'is-just-added',
    (hasActiveReactions || hasActiveStickerEffect) && 'has-active-reaction',
    isStoryMention && 'is-story-mention',
  );

  const {
    text, photo, video, audio,
    voice, document, sticker, contact,
    poll, webPage, invoice, location,
    action, game, storyData, giveaway,
  } = getMessageContent(message);

  const { replyToMsgId, replyToPeerId, isQuote } = messageReplyInfo || {};
  const { userId: storyReplyUserId, storyId: storyReplyId } = storyReplyInfo || {};

  const detectedLanguage = useTextLanguage(
    text?.text,
    !(areTranslationsEnabled || shouldDetectChatLanguage),
    getIsMessageListReady,
  );
  useDetectChatLanguage(message, detectedLanguage, !shouldDetectChatLanguage, getIsMessageListReady);

  const shouldTranslate = isMessageTranslatable(message, !requestedChatTranslationLanguage);
  const { isPending: isTranslationPending, translatedText } = useMessageTranslation(
    chatTranslations, chatId, shouldTranslate ? messageId : undefined, requestedTranslationLanguage,
  );
  // Used to display previous result while new one is loading
  const previousTranslatedText = usePrevious(translatedText, Boolean(shouldTranslate));

  const currentTranslatedText = translatedText || previousTranslatedText;

  const { phoneCall } = action || {};

  const isMediaWithCommentButton = (repliesThreadInfo || (hasLinkedChat && isChannel && isLocal))
    && !isInDocumentGroupNotLast
    && messageListType === 'thread'
    && !noComments;
  const withCommentButton = repliesThreadInfo?.isCommentsInfo
    && !isInDocumentGroupNotLast && messageListType === 'thread'
    && !noComments;
  const withQuickReactionButton = !isTouchScreen && !phoneCall && !isInSelectMode && defaultReaction
    && !isInDocumentGroupNotLast && !isStoryMention;

  const contentClassName = buildContentClassName(message, {
    hasSubheader,
    isCustomShape,
    isLastInGroup,
    asForwarded,
    hasThread: hasThread && !noComments,
    forceSenderName,
    hasComments: repliesThreadInfo && repliesThreadInfo.messagesCount > 0,
    hasActionButton: canForward || canFocus,
    hasReactions,
    isGeoLiveActive: location?.type === 'geoLive' && !isGeoLiveExpired(message),
    withVoiceTranscription,
    peerColorClass: getPeerColorClass(messageColorPeer, noUserColors),
  });

  const withAppendix = contentClassName.includes('has-appendix');
  const emojiSize = getCustomEmojiSize(message.emojiOnlyCount);

  let metaPosition!: MetaPosition;
  if (phoneCall) {
    metaPosition = 'none';
  } else if (isInDocumentGroupNotLast) {
    metaPosition = 'none';
  } else if (hasText && !webPage && !emojiSize) {
    metaPosition = 'in-text';
  } else {
    metaPosition = 'standalone';
  }

  let reactionsPosition!: ReactionsPosition;
  if (hasReactions) {
    if (isCustomShape || ((photo || video || storyData || (location?.type === 'geo')) && !hasText)) {
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
    shouldHideReply || isQuote || isReplyPrivate,
  );

  useEnsureStory(
    storyReplyUserId || chatId,
    storyReplyId,
    replyStory,
  );

  useFocusMessage(
    ref, chatId, isFocused, focusDirection, noFocusHighlight, isResizingContainer, isJustAdded, Boolean(focusedQuote),
  );

  const signature = (isChannel && message.postAuthorTitle)
    || (!asForwarded && forwardInfo?.postAuthorTitle)
    || undefined;
  useAuthorWidth(ref, signature);

  const shouldFocusOnResize = isLastInList;

  const handleResize = useLastCallback((entry: ResizeObserverEntry) => {
    const lastHeight = messageHeightRef.current;

    const newHeight = entry.contentRect.height;
    messageHeightRef.current = newHeight;

    if (isAnimatingScroll() || !lastHeight || newHeight <= lastHeight) return;

    const container = entry.target.closest<HTMLDivElement>('.MessageList');
    if (!container) return;

    dispatchHeavyAnimationEvent(RESIZE_ANIMATION_DURATION);

    const resizeDiff = newHeight - lastHeight;
    const { offsetHeight, scrollHeight, scrollTop } = container;
    const currentScrollBottom = Math.round(scrollHeight - scrollTop - offsetHeight);
    const previousScrollBottom = currentScrollBottom - resizeDiff;

    if (previousScrollBottom <= BOTTOM_FOCUS_SCROLL_THRESHOLD) {
      focusLastMessage();
    }
  });

  const throttledResize = useThrottledCallback(handleResize, [handleResize], THROTTLE_MS, false);

  useResizeObserver(ref, throttledResize, !shouldFocusOnResize);

  useEffect(() => {
    const bottomMarker = bottomMarkerRef.current;
    if (hasUnreadReaction && bottomMarker && isElementInViewport(bottomMarker)) {
      animateUnreadReaction({ messageIds: [messageId] });
    }
  }, [hasUnreadReaction, messageId, animateUnreadReaction]);

  const albumLayout = useMemo(() => {
    return isAlbum
      ? calculateAlbumLayout(isOwn, Boolean(asForwarded), Boolean(noAvatars), album!, isMobile)
      : undefined;
  }, [isAlbum, isOwn, asForwarded, noAvatars, album, isMobile]);

  const extraPadding = asForwarded ? 28 : 0;

  const sizeCalculations = useMemo(() => {
    let calculatedWidth;
    let contentWidth: number | undefined;
    let noMediaCorners = false;
    let style = '';
    let reactionsMaxWidth;

    if (!isAlbum && (photo || video || invoice?.extendedMedia)) {
      let width: number | undefined;
      if (photo) {
        width = calculateMediaDimensions(message, asForwarded, noAvatars, isMobile).width;
      } else if (video) {
        if (video.isRound) {
          width = ROUND_VIDEO_DIMENSIONS_PX;
        } else {
          width = calculateMediaDimensions(message, asForwarded, noAvatars, isMobile).width;
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
        if (width < MIN_MEDIA_WIDTH_WITH_TEXT) {
          contentWidth = width;
        }
        calculatedWidth = Math.max(getMinMediaWidth(text?.text, isMediaWithCommentButton), width);
        if (invoice?.extendedMedia && calculatedWidth - width > NO_MEDIA_CORNERS_THRESHOLD) {
          noMediaCorners = true;
        }
      }
    } else if (albumLayout) {
      calculatedWidth = Math.max(
        getMinMediaWidth(text?.text, isMediaWithCommentButton), albumLayout.containerStyle.width,
      );
      if (calculatedWidth - albumLayout.containerStyle.width > NO_MEDIA_CORNERS_THRESHOLD) {
        noMediaCorners = true;
      }
    }

    if (calculatedWidth) {
      style = `width: ${calculatedWidth + extraPadding}px`;
      reactionsMaxWidth = calculatedWidth + EXTRA_SPACE_FOR_REACTIONS;
    } else if (sticker && !hasSubheader) {
      const { width } = getStickerDimensions(sticker, isMobile);
      style = `width: ${width + extraPadding}px`;
      reactionsMaxWidth = width + EXTRA_SPACE_FOR_REACTIONS;
    }

    return {
      contentWidth, noMediaCorners, style, reactionsMaxWidth,
    };
  }, [
    albumLayout, asForwarded, extraPadding, hasSubheader, invoice?.extendedMedia, isAlbum, isMediaWithCommentButton,
    isMobile, isOwn, message, noAvatars, photo, sticker, text?.text, video,
  ]);

  const {
    contentWidth, noMediaCorners, style, reactionsMaxWidth,
  } = sizeCalculations;

  function renderAvatar() {
    const hiddenName = (!avatarPeer && forwardInfo) ? forwardInfo.hiddenUserName : undefined;

    return (
      <Avatar
        size={isMobile ? 'small-mobile' : 'small'}
        peer={avatarPeer}
        text={hiddenName}
        onClick={avatarPeer ? handleAvatarClick : undefined}
      />
    );
  }

  function renderMessageText(isForAnimation?: boolean) {
    return (
      <MessageText
        messageOrStory={message}
        translatedText={requestedTranslationLanguage ? currentTranslatedText : undefined}
        isForAnimation={isForAnimation}
        focusedQuote={focusedQuote}
        emojiSize={emojiSize}
        highlight={highlight}
        isProtected={isProtected}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        withTranslucentThumbs={isCustomShape}
      />
    );
  }

  const renderQuickReactionButton = useCallback(() => {
    if (!defaultReaction) return undefined;

    return (
      <div
        className={buildClassName('quick-reaction', isQuickReactionVisible && !hasActiveReactions && 'visible')}
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
        onClick={handleMetaClick}
        onTranslationClick={handleTranslationClick}
        onOpenThread={handleOpenThread}
      />
    );

    if (reactionsPosition !== 'inside') {
      return meta;
    }

    return (
      <Reactions
        message={reactionMessage!}
        metaChildren={meta}
        observeIntersection={observeIntersectionForPlaying}
        noRecentReactors={isChannel}
      />
    );
  }

  function renderContent() {
    const className = buildClassName(
      'content-inner',
      asForwarded && 'forwarded-message',
      hasSubheader && 'with-subheader',
      noMediaCorners && 'no-media-corners',
    );
    const hasCustomAppendix = isLastInGroup && !hasText && !asForwarded && !withCommentButton;
    const textContentClass = buildClassName(
      'text-content',
      'clearfix',
      metaPosition === 'in-text' && 'with-meta',
      outgoingStatus && 'with-outgoing-icon',
    );

    return (
      <div className={className} onDoubleClick={handleContentDoubleClick} dir="auto">
        {!asForwarded && renderSenderName()}
        {hasSubheader && (
          <div className="message-subheader">
            {hasTopicChip && (
              <TopicChip
                topic={messageTopic}
                onClick={handleTopicChipClick}
                className="message-topic"
              />
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
          </div>
        )}
        {sticker && (
          <Sticker
            message={message}
            observeIntersection={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            shouldLoop={shouldLoopStickers}
            shouldPlayEffect={(
              sticker.hasEffect && ((
                memoFirstUnreadIdRef.current && messageId >= memoFirstUnreadIdRef.current
              ) || isLocal)
            ) || undefined}
            withEffect={withStickerEffects}
            onPlayEffect={startStickerEffect}
            onStopEffect={stopStickerEffect}
          />
        )}
        {hasAnimatedEmoji && animatedCustomEmoji && (
          <AnimatedCustomEmoji
            customEmojiId={animatedCustomEmoji}
            withEffects={withStickerEffects && isUserId(chatId)}
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
            withEffects={withStickerEffects && isUserId(chatId)}
            isOwn={isOwn}
            observeIntersection={observeIntersectionForLoading}
            forceLoadPreview={isLocal}
            messageId={messageId}
            chatId={chatId}
            activeEmojiInteractions={activeEmojiInteractions}
          />
        )}
        {isAlbum && (
          <Album
            album={album!}
            albumLayout={albumLayout!}
            observeIntersection={observeIntersectionForLoading}
            isOwn={isOwn}
            isProtected={isProtected}
            hasCustomAppendix={hasCustomAppendix}
            onMediaClick={handleAlbumMediaClick}
          />
        )}
        {phoneCall && (
          <MessagePhoneCall
            message={message}
            phoneCall={phoneCall}
            chatId={chatId}
          />
        )}
        {!isAlbum && photo && (
          <Photo
            message={message}
            observeIntersection={observeIntersectionForLoading}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoadMedia}
            uploadProgress={uploadProgress}
            shouldAffectAppendix={hasCustomAppendix}
            isDownloading={isDownloading}
            isProtected={isProtected}
            asForwarded={asForwarded}
            theme={theme}
            forcedWidth={contentWidth}
            onClick={handleMediaClick}
            onCancelUpload={handleCancelUpload}
          />
        )}
        {!isAlbum && video && video.isRound && (
          <RoundVideo
            message={message}
            observeIntersection={observeIntersectionForLoading}
            canAutoLoad={canAutoLoadMedia}
            isDownloading={isDownloading}
          />
        )}
        {!isAlbum && video && !video.isRound && (
          <Video
            message={message}
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
            onClick={handleMediaClick}
            onCancelUpload={handleCancelUpload}
          />
        )}
        {(audio || voice) && (
          <Audio
            theme={theme}
            message={message}
            origin={AudioOrigin.Inline}
            uploadProgress={uploadProgress}
            isSelectable={isInDocumentGroup}
            isSelected={isSelected}
            noAvatars={noAvatars}
            onPlay={handleAudioPlay}
            onReadMedia={voice && (!isOwn || isChatWithSelf) ? handleReadMedia : undefined}
            onCancelUpload={handleCancelUpload}
            isDownloading={isDownloading}
            isTranscribing={isTranscribing}
            isTranscriptionHidden={isTranscriptionHidden}
            isTranscribed={Boolean(transcribedText)}
            isTranscriptionError={isTranscriptionError}
            canDownload={!isProtected}
            onHideTranscription={setTranscriptionHidden}
            canTranscribe={isPremium}
          />
        )}
        {document && (
          <Document
            message={message}
            observeIntersection={observeIntersectionForLoading}
            canAutoLoad={canAutoLoadMedia}
            autoLoadFileMaxSizeMb={autoLoadFileMaxSizeMb}
            uploadProgress={uploadProgress}
            isSelectable={isInDocumentGroup}
            isSelected={isSelected}
            onMediaClick={handleMediaClick}
            onCancelUpload={handleCancelUpload}
            isDownloading={isDownloading}
            shouldWarnAboutSvg={shouldWarnAboutSvg}
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
          <Contact contact={contact} />
        )}
        {poll && (
          <Poll message={message} poll={poll} onSendVote={handleVoteSend} />
        )}
        {giveaway && (
          <Giveaway message={message} />
        )}
        {game && (
          <Game
            message={message}
            canAutoLoadMedia={canAutoLoadMedia}
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
            {(isTranscriptionError ? lang('NoWordsRecognized') : (
              isTranscribing && transcribedText ? <DotAnimation content={transcribedText} /> : transcribedText
            ))}
          </p>
        )}

        {!hasAnimatedEmoji && hasText && (
          <div className={textContentClass} dir="auto">
            {renderMessageText()}
            {isTranslationPending && (
              <div className="translation-animation">
                <div className="text-loading">
                  {renderMessageText(true)}
                </div>
              </div>
            )}
            {metaPosition === 'in-text' && renderReactionsAndMeta()}
          </div>
        )}

        {webPage && (
          <WebPage
            message={message}
            observeIntersection={observeIntersectionForLoading}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoadMedia}
            canAutoPlay={canAutoPlayMedia}
            asForwarded={asForwarded}
            isDownloading={isDownloading}
            isProtected={isProtected}
            theme={theme}
            story={webPageStory}
            isConnected={isConnected}
            noUserColors={isOwn}
            onMediaClick={handleMediaClick}
            onCancelMediaTransfer={handleCancelUpload}
          />
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

  function renderSenderName() {
    const media = photo || video || location;
    const shouldRender = !(isCustomShape && !viaBotId) && (
      (withSenderName && (!media || hasTopicChip)) || asForwarded || viaBotId || forceSenderName
    ) && !isInDocumentGroupNotFirst && !(hasMessageReply && isCustomShape);

    if (!shouldRender) {
      return undefined;
    }

    let senderTitle;
    let senderColor;
    if (senderPeer && !(isCustomShape && viaBotId)) {
      senderTitle = getSenderTitle(lang, senderPeer);
    } else if (forwardInfo?.hiddenUserName) {
      senderTitle = forwardInfo.hiddenUserName;
    } else if (storyData && originSender) {
      senderTitle = getSenderTitle(lang, originSender!);
    }
    const senderEmojiStatus = senderPeer && 'emojiStatus' in senderPeer && senderPeer.emojiStatus;
    const senderIsPremium = senderPeer && 'isPremium' in senderPeer && senderPeer.isPremium;

    return (
      <div className="message-title" dir="ltr">
        {(senderTitle || asForwarded) ? (
          <span
            className={buildClassName(
              'message-title-name',
              forwardInfo?.hiddenUserName ? 'sender-hidden' : 'interactive',
              senderColor,
            )}
            onClick={handleSenderClick}
            dir="ltr"
          >
            {asForwarded && (
              <Icon name={forwardInfo?.hiddenUserName ? 'forward' : 'share-filled'} />
            )}
            {storyData && <Icon name="play-story" />}
            {senderTitle ? renderText(senderTitle) : (asForwarded ? NBSP : undefined)}
            {!asForwarded && senderEmojiStatus && (
              <CustomEmoji
                documentId={senderEmojiStatus.documentId}
                loopLimit={EMOJI_STATUS_LOOP_LIMIT}
                observeIntersectionForLoading={observeIntersectionForLoading}
                observeIntersectionForPlaying={observeIntersectionForPlaying}
              />
            )}
            {!asForwarded && !senderEmojiStatus && senderIsPremium && <PremiumIcon />}
            {senderPeer?.fakeType && <FakeIcon fakeType={senderPeer.fakeType} />}
          </span>
        ) : !botSender ? (
          NBSP
        ) : undefined}
        {botSender && (
          <>
            <span className="via">{lang('ViaBot')}</span>
            <span
              className="interactive"
              onClick={handleViaBotClick}
            >
              {renderText(`@${botSender.usernames![0].username}`)}
            </span>
          </>
        )}
        {forwardInfo?.isLinkedChannelPost ? (
          <span className="admin-title" dir="auto">{lang('DiscussChannel')}</span>
        ) : message.forwardInfo?.postAuthorTitle && isGroup && asForwarded ? (
          <span className="admin-title" dir="auto">{message.forwardInfo?.postAuthorTitle}</span>
        ) : message.postAuthorTitle && isGroup && !asForwarded ? (
          <span className="admin-title" dir="auto">{message.postAuthorTitle}</span>
        ) : senderAdminMember && !asForwarded && !viaBotId ? (
          <span className="admin-title" dir="auto">
            {senderAdminMember.customTitle || lang(
              senderAdminMember.isOwner ? 'GroupInfo.LabelOwner' : 'GroupInfo.LabelAdmin',
            )}
          </span>
        ) : undefined}
      </div>
    );
  }

  const forwardAuthor = isGroup && asForwarded ? message.postAuthorTitle : undefined;

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
        <div className="message-select-control">
          {isSelected && <i className="icon icon-select" />}
        </div>
      )}
      {isLastInDocumentGroup && (
        <div
          className={buildClassName('message-select-control group-select', isGroupSelected && 'is-selected')}
          onClick={handleDocumentGroupSelectAll}
        >
          {isGroupSelected && (
            <i className="icon icon-select" />
          )}
        </div>
      )}
      {withAvatar && renderAvatar()}
      <div
        className={buildClassName('message-content-wrapper', contentClassName.includes('text') && 'can-select-text')}
      >
        <div
          className={contentClassName}
          style={style}
          dir="auto"
        >
          {asForwarded && !isInDocumentGroupNotFirst && (
            <>
              {renderSenderName()}
              {forwardAuthor && <span className="admin-title" dir="auto">{forwardAuthor}</span>}
            </>
          )}
          {renderContent()}
          {!isInDocumentGroupNotLast && metaPosition === 'standalone' && !isStoryMention && renderReactionsAndMeta()}
          {canShowActionButton && canForward ? (
            <Button
              className={buildClassName(
                'message-action-button', isLoadingComments && 'message-action-button-shown',
              )}
              color="translucent-white"
              round
              size="tiny"
              ariaLabel={lang('lng_context_forward_msg')}
              onClick={isLastInDocumentGroup ? handleGroupForward : handleForward}
            >
              <i className="icon icon-share-filled" />
            </Button>
          ) : canShowActionButton && canFocus ? (
            <Button
              className={buildClassName(
                'message-action-button', isLoadingComments && 'message-action-button-shown',
              )}
              color="translucent-white"
              round
              size="tiny"
              ariaLabel="Focus message"
              onClick={isPinnedList ? handleFocus : handleFocusForwarded}
            >
              <i className="icon icon-arrow-right" />
            </Button>
          ) : undefined}
          {withCommentButton && (
            <CommentButton
              threadInfo={repliesThreadInfo}
              disabled={noComments}
              isLoading={isLoadingComments}
              isCustomShape={isCustomShape}
            />
          )}
          {withAppendix && <MessageAppendix isOwn={isOwn} />}
          {withQuickReactionButton && quickReactionPosition === 'in-content' && renderQuickReactionButton()}
        </div>
        {message.inlineButtons && (
          <InlineButtons message={message} onClick={clickBotInlineButton} />
        )}
        {reactionsPosition === 'outside' && !isStoryMention && (
          <Reactions
            message={reactionMessage!}
            isOutside
            maxWidth={reactionsMaxWidth}
            observeIntersection={observeIntersectionForPlaying}
            noRecentReactors={isChannel}
          />
        )}
      </div>
      {contextMenuPosition && (
        <ContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuPosition}
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
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, ownProps): StateProps => {
    const {
      focusedMessage, forwardMessages, activeReactions, activeEmojiInteractions,
      loadingThread,
    } = selectTabState(global);
    const {
      message, album, withSenderName, withAvatar, threadId, messageListType, isLastInDocumentGroup, isFirstInGroup,
    } = ownProps;
    const {
      id, chatId, viaBotId, isOutgoing, forwardInfo, transcriptionId, isPinned,
    } = message;

    const chat = selectChat(global, chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isRepliesChat = isChatWithRepliesBot(chatId);
    const isChannel = chat && isChatChannel(chat);
    const isGroup = chat && isChatGroup(chat);
    const chatFullInfo = !isUserId(chatId) ? selectChatFullInfo(global, chatId) : undefined;
    const webPageStoryData = message.content.webPage?.story;
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
    const { userId: storyReplyUserId, storyId: storyReplyId } = getStoryReplyInfo(message) || {};

    const shouldHideReply = replyToMsgId && replyToMsgId === threadId;
    const replyMessage = replyToMsgId ? selectChatMessage(global, replyToPeerId || chatId, replyToMsgId) : undefined;
    const forwardHeader = forwardInfo || replyFrom;
    const replyMessageSender = replyMessage ? selectReplySender(global, replyMessage) : forwardHeader && !isRepliesChat
      ? selectSenderFromHeader(global, forwardHeader) : undefined;
    const replyMessageForwardSender = replyMessage && selectForwardedSender(global, replyMessage);
    const replyMessageChat = replyToPeerId ? selectChat(global, replyToPeerId) : undefined;
    const isReplyPrivate = !isRepliesChat && replyMessageChat && !isChatPublic(replyMessageChat)
      && (replyMessageChat.isNotJoined || replyMessageChat.isRestricted);
    const isReplyToTopicStart = replyMessage?.content.action?.type === 'topicCreate';
    const replyStory = storyReplyId && storyReplyUserId
      ? selectPeerStory(global, storyReplyUserId, storyReplyId)
      : undefined;
    const storySender = storyReplyUserId ? selectUser(global, storyReplyUserId) : undefined;

    const uploadProgress = selectUploadProgress(global, message);
    const isFocused = messageListType === 'thread' && (
      album
        ? album.messages.some((m) => selectIsMessageFocused(global, m, threadId))
        : selectIsMessageFocused(global, message, threadId)
    );

    const {
      direction: focusDirection, noHighlight: noFocusHighlight, isResizingContainer, quote: focusedQuote,
    } = (isFocused && focusedMessage) || {};

    const { query: highlight } = selectCurrentTextSearch(global) || {};

    const singleEmoji = getMessageSingleRegularEmoji(message);
    const animatedEmoji = singleEmoji && selectAnimatedEmoji(global, singleEmoji) ? singleEmoji : undefined;
    const animatedCustomEmoji = getMessageSingleCustomEmoji(message);

    let isSelected: boolean;
    if (album?.messages) {
      isSelected = album.messages.every(({ id: messageId }) => selectIsMessageSelected(global, messageId));
    } else {
      isSelected = selectIsMessageSelected(global, id);
    }

    const { canReply } = (messageListType === 'thread' && selectAllowedMessageActions(global, message, threadId)) || {};
    const isDownloading = selectIsDownloading(global, message);

    const repliesThreadInfo = selectThreadInfo(global, chatId, album?.mainMessage.id || id);

    const isInDocumentGroup = Boolean(message.groupedId) && !message.isInAlbum;
    const documentGroupFirstMessageId = isInDocumentGroup
      ? selectMessageIdsByGroupId(global, chatId, message.groupedId!)![0]
      : undefined;
    const reactionMessage = isInDocumentGroup ? (
      isLastInDocumentGroup ? selectChatMessage(global, chatId, documentGroupFirstMessageId!) : undefined
    ) : message;

    const hasUnreadReaction = chat?.unreadReactions?.includes(message.id);

    const hasTopicChip = threadId === MAIN_THREAD_ID && chat?.isForum && isFirstInGroup;
    const messageTopic = hasTopicChip ? (selectTopicFromMessage(global, message) || chat?.topics?.[GENERAL_TOPIC_ID])
      : undefined;

    const chatTranslations = selectChatTranslations(global, chatId);

    const requestedTranslationLanguage = selectRequestedMessageTranslationLanguage(global, chatId, message.id);
    const requestedChatTranslationLanguage = selectRequestedChatTranslationLanguage(global, chatId);

    const areTranslationsEnabled = IS_TRANSLATION_SUPPORTED && global.settings.byKey.canTranslate
      && !requestedChatTranslationLanguage; // Stop separate language detection if chat translation is requested

    const isConnected = global.connectionState === 'connectionStateReady';

    const hasActiveReactions = Boolean(reactionMessage && activeReactions[getMessageKey(reactionMessage)]?.length);

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
      isRepliesChat,
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
      availableReactions: global.availableReactions,
      defaultReaction: isMessageLocal(message) || messageListType === 'scheduled'
        ? undefined : selectDefaultReaction(global, chatId),
      hasActiveReactions,
      activeEmojiInteractions,
      hasUnreadReaction,
      isTranscribing: transcriptionId !== undefined && global.transcriptions[transcriptionId]?.isPending,
      transcribedText: transcriptionId !== undefined ? global.transcriptions[transcriptionId]?.text : undefined,
      isPremium: selectIsCurrentUserPremium(global),
      senderAdminMember,
      messageTopic,
      hasTopicChip,
      chatTranslations,
      areTranslationsEnabled,
      shouldDetectChatLanguage: selectShouldDetectChatLanguage(global, chatId),
      requestedTranslationLanguage,
      requestedChatTranslationLanguage,
      hasLinkedChat: Boolean(chatFullInfo?.linkedChatId),
      withStickerEffects: selectPerformanceSettingsValue(global, 'stickerEffects'),
      webPageStory,
      isConnected,
      isLoadingComments: repliesThreadInfo?.isCommentsInfo
        && loadingThread?.loadingChatId === repliesThreadInfo?.originChannelId
        && loadingThread?.loadingMessageId === repliesThreadInfo?.originMessageId,
      shouldWarnAboutSvg: global.settings.byKey.shouldWarnAboutSvg,
      ...(isOutgoing && { outgoingStatus: selectOutgoingStatus(global, message, messageListType === 'scheduled') }),
      ...(typeof uploadProgress === 'number' && { uploadProgress }),
      ...(isFocused && {
        focusDirection,
        noFocusHighlight,
        isResizingContainer,
        focusedQuote,
      }),
    };
  },
)(Message));
