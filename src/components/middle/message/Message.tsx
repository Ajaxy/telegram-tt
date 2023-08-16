import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import type {
  ActiveEmojiInteraction,
  ActiveReaction,
  ChatTranslatedMessages,
  MessageListType,
} from '../../../global/types';
import type {
  ApiAvailableReaction,
  ApiChat,
  ApiChatMember,
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiReaction,
  ApiStickerSet,
  ApiThreadInfo,
  ApiTopic,
  ApiTypeStory,
  ApiUser,
  ApiUsername,
} from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';
import type { FocusDirection, IAlbum, ISettings } from '../../../types';
import { AudioOrigin } from '../../../types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { useOnIntersect } from '../../../hooks/useIntersectionObserver';
import type { PinnedIntersectionChangedCallback } from '../hooks/usePinnedMessage';
import type { Signal } from '../../../util/signals';

import { IS_ANDROID, IS_TRANSLATION_SUPPORTED } from '../../../util/windowEnvironment';
import { EMOJI_STATUS_LOOP_LIMIT, GENERAL_TOPIC_ID, IS_ELECTRON } from '../../../config';
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
  selectPerformanceSettingsValue,
  selectReplySender,
  selectRequestedChatTranslationLanguage,
  selectRequestedMessageTranslationLanguage,
  selectSender,
  selectShouldDetectChatLanguage,
  selectShouldLoopStickers,
  selectTabState,
  selectTheme,
  selectThreadInfo,
  selectThreadTopMessageId,
  selectTopicFromMessage,
  selectUploadProgress,
  selectUser,
  selectUserStory,
} from '../../../global/selectors';
import {
  areReactionsEmpty,
  getMessageContent,
  getMessageCustomShape,
  getMessageHtmlId,
  getMessageLocation,
  getMessageSingleCustomEmoji,
  getMessageSingleRegularEmoji,
  getSenderTitle,
  getUserColorKey,
  hasMessageText,
  isAnonymousOwnMessage,
  isChatChannel,
  isChatGroup,
  isChatWithRepliesBot,
  isGeoLiveExpired,
  isMessageLocal,
  isMessageTranslatable,
  isOwnMessage,
  isReplyMessage,
  isUserId,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import {
  calculateDimensionsForMessageMedia,
  getStickerDimensions,
  REM,
  ROUND_VIDEO_DIMENSIONS_PX,
} from '../../common/helpers/mediaDimensions';
import { buildContentClassName } from './helpers/buildContentClassName';
import { calculateMediaDimensions, getMinMediaWidth, MIN_MEDIA_WIDTH_WITH_TEXT } from './helpers/mediaDimensions';
import { calculateAlbumLayout } from './helpers/calculateAlbumLayout';
import renderText from '../../common/helpers/renderText';
import { isElementInViewport } from '../../../util/isElementInViewport';
import { getCustomEmojiSize } from '../composer/helpers/customEmoji';
import { isAnimatingScroll } from '../../../util/animateScroll';

import useLastCallback from '../../../hooks/useLastCallback';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useLang from '../../../hooks/useLang';
import useShowTransition from '../../../hooks/useShowTransition';
import useFlag from '../../../hooks/useFlag';
import useFocusMessage from './hooks/useFocusMessage';
import useOuterHandlers from './hooks/useOuterHandlers';
import useInnerHandlers from './hooks/useInnerHandlers';
import useAppLayout from '../../../hooks/useAppLayout';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useThrottledCallback from '../../../hooks/useThrottledCallback';
import useMessageTranslation from './hooks/useMessageTranslation';
import usePrevious from '../../../hooks/usePrevious';
import useTextLanguage from '../../../hooks/useTextLanguage';
import useAuthorWidth from '../hooks/useAuthorWidth';
import useEnsureStory from '../../../hooks/useEnsureStory';
import { dispatchHeavyAnimationEvent } from '../../../hooks/useHeavyAnimationCheck';
import useDetectChatLanguage from './hooks/useDetectChatLanguage';

import Button from '../../ui/Button';
import Avatar from '../../common/Avatar';
import EmbeddedMessage from '../../common/EmbeddedMessage';
import Document from '../../common/Document';
import Audio from '../../common/Audio';
import MessageMeta from './MessageMeta';
import ContextMenuContainer from './ContextMenuContainer.async';
import Sticker from './Sticker';
import AnimatedEmoji from './AnimatedEmoji';
import AnimatedCustomEmoji from './AnimatedCustomEmoji';
import Photo from './Photo';
import Video from './Video';
import Contact from './Contact';
import Poll from './Poll';
import WebPage from './WebPage';
import Invoice from './Invoice';
import InvoiceMediaPreview from './InvoiceMediaPreview';
import Location from './Location';
import Game from './Game';
import Album from './Album';
import RoundVideo from './RoundVideo';
import InlineButtons from './InlineButtons';
import CommentButton from './CommentButton';
import Reactions from './Reactions';
import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import MessagePhoneCall from './MessagePhoneCall';
import DotAnimation from '../../common/DotAnimation';
import CustomEmoji from '../../common/CustomEmoji';
import PremiumIcon from '../../common/PremiumIcon';
import FakeIcon from '../../common/FakeIcon';
import MessageText from '../../common/MessageText';
import TopicChip from '../../common/TopicChip';
import EmbeddedStory from '../../common/EmbeddedStory';
import Story from './Story';
import StoryMention from './StoryMention';

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
    onPinnedIntersectionChange: PinnedIntersectionChangedCallback;
    getIsMessageListReady: Signal<boolean>;
  }
  & MessagePositionProperties;

type StateProps = {
  theme: ISettings['theme'];
  forceSenderName?: boolean;
  chatUsernames?: ApiUsername[];
  sender?: ApiUser | ApiChat;
  canShowSender: boolean;
  originSender?: ApiUser | ApiChat;
  botSender?: ApiUser;
  isThreadTop?: boolean;
  shouldHideReply?: boolean;
  replyMessage?: ApiMessage;
  replyMessageSender?: ApiUser | ApiChat;
  replyStory?: ApiTypeStory;
  storySender?: ApiUser;
  outgoingStatus?: ApiMessageOutgoingStatus;
  uploadProgress?: number;
  isInDocumentGroup: boolean;
  isProtected?: boolean;
  isChatProtected?: boolean;
  isFocused?: boolean;
  focusDirection?: FocusDirection;
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
  genericEffects?: ApiStickerSet;
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
  activeReactions?: ActiveReaction[];
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
  withReactionEffects?: boolean;
  withStickerEffects?: boolean;
  webPageStory?: ApiTypeStory;
  isConnected: boolean;
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
  chatUsernames,
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
  replyStory,
  storySender,
  outgoingStatus,
  uploadProgress,
  isInDocumentGroup,
  isProtected,
  isChatProtected,
  isFocused,
  focusDirection,
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
  genericEffects,
  hasLinkedChat,
  isInSelectMode,
  isSelected,
  isGroupSelected,
  threadId,
  reactionMessage,
  availableReactions,
  defaultReaction,
  activeReactions,
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
  withReactionEffects,
  withStickerEffects,
  webPageStory,
  isConnected,
  onPinnedIntersectionChange,
  getIsMessageListReady,
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
  const hasReply = isReplyMessage(message) && !shouldHideReply;
  const hasStoryReply = Boolean(message.replyToStoryId);
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

  const hasSubheader = hasTopicChip || hasReply || hasStoryReply;

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
  const senderPeer = forwardInfo ? originSender : messageSender;

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
    isRepliesChat,
    album,
    avatarPeer,
    senderPeer,
    botSender,
    messageTopic,
    Boolean(requestedChatTranslationLanguage),
    replyStory && 'content' in replyStory ? replyStory : undefined,
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
    isProtected ? 'is-protected' : 'allow-selection',
    isLastInGroup && 'last-in-group',
    isFirstInDocumentGroup && 'first-in-document-group',
    isLastInDocumentGroup && 'last-in-document-group',
    isLastInList && 'last-in-list',
    isOwn && 'own',
    Boolean(message.views) && 'has-views',
    message.isEdited && 'was-edited',
    hasReply && 'has-reply',
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
    (Boolean(activeReactions) || hasActiveStickerEffect) && 'has-active-reaction',
    isStoryMention && 'is-story-mention',
  );

  const {
    text, photo, video, audio,
    voice, document, sticker, contact,
    poll, webPage, invoice, location,
    action, game, storyData,
  } = getMessageContent(message);

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
  const withCommentButton = repliesThreadInfo && !isInDocumentGroupNotLast && messageListType === 'thread'
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
  });

  const withAppendix = contentClassName.includes('has-appendix');
  const hasText = hasMessageText(message);
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
    if (isCustomShape || ((photo || video || storyData || (location && location.type === 'geo')) && !hasText)) {
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
    isRepliesChat && message.replyToChatId ? message.replyToChatId : chatId,
    hasReply ? message.replyToMessageId : undefined,
    replyMessage,
    message.id,
  );

  useEnsureStory(
    message.replyToStoryUserId ? message.replyToStoryUserId : chatId,
    message.replyToStoryId,
    replyStory,
  );

  useFocusMessage(
    ref, chatId, isFocused, focusDirection, noFocusHighlight, isResizingContainer, isJustAdded,
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
        className={buildClassName('quick-reaction', isQuickReactionVisible && !activeReactions && 'visible')}
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
    activeReactions, availableReactions, defaultReaction, handleSendQuickReaction, isQuickReactionVisible,
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
        activeReactions={activeReactions}
        message={reactionMessage!}
        metaChildren={meta}
        availableReactions={availableReactions}
        genericEffects={genericEffects}
        observeIntersection={observeIntersectionForPlaying}
        noRecentReactors={isChannel}
        withEffects={withReactionEffects}
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
            {hasReply && (
              <EmbeddedMessage
                message={replyMessage}
                noUserColors={isOwn || isChannel}
                isProtected={isProtected}
                sender={replyMessageSender}
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
                noUserColors={isOwn || isChannel}
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
    ) && !isInDocumentGroupNotFirst && !(hasReply && isCustomShape);

    if (!shouldRender) {
      return undefined;
    }

    let senderTitle;
    let senderColor;
    if (senderPeer && !(isCustomShape && viaBotId)) {
      senderTitle = getSenderTitle(lang, senderPeer);

      if (!asForwarded && !isOwn) {
        senderColor = `color-${getUserColorKey(senderPeer)}`;
      }
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
              <i className={`icon ${forwardInfo?.hiddenUserName ? 'icon-forward' : 'icon-share-filled'}`} />
            )}
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
  const chatUsername = useMemo(() => chatUsernames?.find((c) => c.isActive), [chatUsernames]);

  return (
    <div
      ref={ref}
      id={getMessageHtmlId(message.id)}
      className={containerClassName}
      data-message-id={messageId}
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
        data-should-update-views={message.views !== undefined}
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
              className="message-action-button"
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
              className="message-action-button"
              color="translucent-white"
              round
              size="tiny"
              ariaLabel="Focus message"
              onClick={isPinnedList ? handleFocus : handleFocusForwarded}
            >
              <i className="icon icon-arrow-right" />
            </Button>
          ) : undefined}
          {withCommentButton && <CommentButton threadInfo={repliesThreadInfo!} disabled={noComments} />}
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
            activeReactions={activeReactions}
            availableReactions={availableReactions}
            genericEffects={genericEffects}
            observeIntersection={observeIntersectionForPlaying}
            noRecentReactors={isChannel}
            withEffects={withReactionEffects}
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
          chatUsername={chatUsername?.username}
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

function MessageAppendix({ isOwn } : { isOwn: boolean }) {
  const path = isOwn
    ? 'M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z'
    : 'M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z';
  return (
    <svg width="9" height="20" className="svg-appendix">
      <defs>
        <filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="messageAppendix">
          <feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1" />
          <feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1" />
          <feColorMatrix
            values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0"
            in="shadowBlurOuter1"
          />
        </filter>
      </defs>
      <g fill="none" fill-rule="evenodd">
        <path d={path} fill="#000" filter="url(#messageAppendix)" />
        <path d={path} fill={isOwn ? '#EEFFDE' : 'FFF'} className="corner" />
      </g>
    </svg>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, ownProps): StateProps => {
    const {
      focusedMessage, forwardMessages, activeReactions, activeEmojiInteractions,
    } = selectTabState(global);
    const {
      message, album, withSenderName, withAvatar, threadId, messageListType, isLastInDocumentGroup, isFirstInGroup,
    } = ownProps;
    const {
      id, chatId, viaBotId, replyToChatId, replyToMessageId, isOutgoing, forwardInfo,
      transcriptionId, isPinned, replyToStoryUserId, replyToStoryId, repliesThreadInfo,
    } = message;

    const chat = selectChat(global, chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isRepliesChat = isChatWithRepliesBot(chatId);
    const isChannel = chat && isChatChannel(chat);
    const isGroup = chat && isChatGroup(chat);
    const chatUsernames = chat?.usernames;
    const chatFullInfo = !isUserId(chatId) ? selectChatFullInfo(global, chatId) : undefined;
    const webPageStoryData = message.content.webPage?.story;
    const webPageStory = webPageStoryData
      ? selectUserStory(global, webPageStoryData.userId, webPageStoryData.id)
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

    const threadTopMessageId = threadId ? selectThreadTopMessageId(global, chatId, threadId) : undefined;
    const isThreadTop = message.id === threadTopMessageId;

    const shouldHideReply = replyToMessageId === threadTopMessageId;
    const replyMessage = replyToMessageId && !shouldHideReply
      ? selectChatMessage(global, isRepliesChat && replyToChatId ? replyToChatId : chatId, replyToMessageId)
      : undefined;
    const replyMessageSender = replyMessage && selectReplySender(global, replyMessage, Boolean(forwardInfo));
    const isReplyToTopicStart = replyMessage?.content.action?.type === 'topicCreate';
    const replyStory = replyToStoryId && replyToStoryUserId
      ? selectUserStory(global, replyToStoryUserId, replyToStoryId)
      : undefined;
    const storySender = replyToStoryUserId ? selectUser(global, replyToStoryUserId) : undefined;

    const uploadProgress = selectUploadProgress(global, message);
    const isFocused = messageListType === 'thread' && (
      album
        ? album.messages.some((m) => selectIsMessageFocused(global, m, threadId))
        : selectIsMessageFocused(global, message, threadId)
    );

    const {
      direction: focusDirection, noHighlight: noFocusHighlight, isResizingContainer,
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
    const actualRepliesThreadInfo = repliesThreadInfo
      ? selectThreadInfo(global, repliesThreadInfo.chatId, repliesThreadInfo.threadId) || repliesThreadInfo
      : undefined;

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

    const isLocation = Boolean(getMessageLocation(message));
    const chatTranslations = selectChatTranslations(global, chatId);

    const requestedTranslationLanguage = selectRequestedMessageTranslationLanguage(global, chatId, message.id);
    const requestedChatTranslationLanguage = selectRequestedChatTranslationLanguage(global, chatId);

    const areTranslationsEnabled = IS_TRANSLATION_SUPPORTED && global.settings.byKey.canTranslate
      && !requestedChatTranslationLanguage; // Stop separate language detection if chat translation is requested

    const isConnected = global.connectionState === 'connectionStateReady';

    return {
      theme: selectTheme(global),
      chatUsernames,
      forceSenderName,
      canShowSender,
      originSender,
      botSender,
      shouldHideReply: shouldHideReply || isReplyToTopicStart,
      isThreadTop,
      replyMessage,
      replyMessageSender,
      replyStory,
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
      repliesThreadInfo: actualRepliesThreadInfo,
      availableReactions: global.availableReactions,
      defaultReaction: isMessageLocal(message) || messageListType === 'scheduled'
        ? undefined : selectDefaultReaction(global, chatId),
      activeReactions: reactionMessage && activeReactions[reactionMessage.id],
      activeEmojiInteractions,
      hasUnreadReaction,
      isTranscribing: transcriptionId !== undefined && global.transcriptions[transcriptionId]?.isPending,
      transcribedText: transcriptionId !== undefined ? global.transcriptions[transcriptionId]?.text : undefined,
      isPremium: selectIsCurrentUserPremium(global),
      senderAdminMember,
      messageTopic,
      genericEffects: global.genericEmojiEffects,
      hasTopicChip,
      chatTranslations,
      areTranslationsEnabled,
      shouldDetectChatLanguage: selectShouldDetectChatLanguage(global, chatId),
      requestedTranslationLanguage,
      requestedChatTranslationLanguage,
      hasLinkedChat: Boolean(chatFullInfo?.linkedChatId),
      withReactionEffects: selectPerformanceSettingsValue(global, 'reactionEffects'),
      withStickerEffects: selectPerformanceSettingsValue(global, 'stickerEffects'),
      webPageStory,
      isConnected,
      ...((canShowSender || isLocation) && { sender }),
      ...(isOutgoing && { outgoingStatus: selectOutgoingStatus(global, message, messageListType === 'scheduled') }),
      ...(typeof uploadProgress === 'number' && { uploadProgress }),
      ...(isFocused && {
        focusDirection,
        noFocusHighlight,
        isResizingContainer,
      }),
    };
  },
)(Message));
