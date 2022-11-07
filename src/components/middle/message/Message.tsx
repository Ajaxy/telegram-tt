import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ActiveEmojiInteraction, ActiveReaction, MessageListType } from '../../../global/types';
import type {
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiUser,
  ApiChat,
  ApiThreadInfo,
  ApiAvailableReaction,
} from '../../../api/types';
import type {
  AnimationLevel, FocusDirection, IAlbum, ISettings,
} from '../../../types';
import {
  AudioOrigin,
} from '../../../types';

import { IS_ANDROID, IS_TOUCH_ENV } from '../../../util/environment';
import { EMOJI_STATUS_LOOP_LIMIT } from '../../../config';
import {
  selectChat,
  selectChatMessage,
  selectUploadProgress,
  selectIsChatWithSelf,
  selectOutgoingStatus,
  selectUser,
  selectIsMessageFocused,
  selectCurrentTextSearch,
  selectIsInSelectMode,
  selectIsMessageSelected,
  selectIsDocumentGroupSelected,
  selectSender,
  selectForwardedSender,
  selectThreadTopMessageId,
  selectCanAutoLoadMedia,
  selectCanAutoPlayMedia,
  selectShouldLoopStickers,
  selectTheme,
  selectAllowedMessageActions,
  selectIsDownloading,
  selectThreadInfo,
  selectMessageIdsByGroupId,
  selectIsMessageProtected,
  selectDefaultReaction,
  selectReplySender,
  selectAnimatedEmoji,
  selectLocalAnimatedEmoji,
  selectIsCurrentUserPremium,
  selectIsChatProtected,
} from '../../../global/selectors';
import {
  getMessageContent,
  isOwnMessage,
  isReplyMessage,
  isAnonymousOwnMessage,
  isMessageLocal,
  isUserId,
  isChatWithRepliesBot,
  getMessageCustomShape,
  isChatChannel,
  getMessageSingleRegularEmoji,
  getSenderTitle,
  getUserColorKey,
  areReactionsEmpty,
  getMessageHtmlId,
  isGeoLiveExpired,
  getMessageSingleCustomEmoji,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { renderMessageText } from '../../common/helpers/renderMessageText';
import { calculateDimensionsForMessageMedia, ROUND_VIDEO_DIMENSIONS_PX } from '../../common/helpers/mediaDimensions';
import { buildContentClassName } from './helpers/buildContentClassName';
import { getMinMediaWidth, calculateMediaDimensions } from './helpers/mediaDimensions';
import { calculateAlbumLayout } from './helpers/calculateAlbumLayout';
import renderText from '../../common/helpers/renderText';
import calculateAuthorWidth from './helpers/calculateAuthorWidth';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useShowTransition from '../../../hooks/useShowTransition';
import useFlag from '../../../hooks/useFlag';
import useFocusMessage from './hooks/useFocusMessage';
import useOuterHandlers from './hooks/useOuterHandlers';
import useInnerHandlers from './hooks/useInnerHandlers';
import { getServerTime } from '../../../util/serverTime';
import { isElementInViewport } from '../../../util/isElementInViewport';
import { getCustomEmojiSize } from '../composer/helpers/customEmoji';

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
    observeIntersectionForMedia: ObserveFn;
    observeIntersectionForAnimatedStickers: ObserveFn;
    album?: IAlbum;
    noAvatars?: boolean;
    withAvatar?: boolean;
    withSenderName?: boolean;
    areReactionsInMeta?: boolean;
    threadId: number;
    messageListType: MessageListType;
    noComments: boolean;
    appearanceOrder: number;
    memoFirstUnreadIdRef: { current: number | undefined };
  }
  & MessagePositionProperties;

type StateProps = {
  theme: ISettings['theme'];
  forceSenderName?: boolean;
  chatUsername?: string;
  sender?: ApiUser | ApiChat;
  canShowSender: boolean;
  originSender?: ApiUser | ApiChat;
  botSender?: ApiUser;
  isThreadTop?: boolean;
  shouldHideReply?: boolean;
  replyMessage?: ApiMessage;
  replyMessageSender?: ApiUser | ApiChat;
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
  canReply?: boolean;
  lastSyncTime?: number;
  serverTimeOffset: number;
  highlight?: string;
  animatedEmoji?: string;
  animatedCustomEmoji?: string;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  isGroupSelected?: boolean;
  isDownloading: boolean;
  threadId?: number;
  isPinnedList?: boolean;
  canAutoLoadMedia?: boolean;
  canAutoPlayMedia?: boolean;
  shouldLoopStickers?: boolean;
  autoLoadFileMaxSizeMb: number;
  threadInfo?: ApiThreadInfo;
  reactionMessage?: ApiMessage;
  availableReactions?: ApiAvailableReaction[];
  defaultReaction?: string;
  activeReaction?: ActiveReaction;
  activeEmojiInteractions?: ActiveEmojiInteraction[];
  hasUnreadReaction?: boolean;
  isTranscribing?: boolean;
  transcribedText?: string;
  isTranscriptionError?: boolean;
  isPremium: boolean;
  animationLevel: AnimationLevel;
};

type MetaPosition =
  'in-text'
  | 'standalone'
  | 'none';
type ReactionsPosition =
  'inside'
  | 'outside'
  | 'in-meta'
  | 'none';

const NBSP = '\u00A0';
// eslint-disable-next-line max-len
const APPENDIX_OWN = { __html: '<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"/><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"/></filter></defs><g fill="none" fill-rule="evenodd"><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#000" filter="url(#a)"/><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#EEFFDE" class="corner"/></g></svg>' };
// eslint-disable-next-line max-len
const APPENDIX_NOT_OWN = { __html: '<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"/><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"/></filter></defs><g fill="none" fill-rule="evenodd"><path d="M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z" fill="#000" filter="url(#a)"/><path d="M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z" fill="#FFF" class="corner"/></g></svg>' };
const APPEARANCE_DELAY = 10;
const NO_MEDIA_CORNERS_THRESHOLD = 18;

const Message: FC<OwnProps & StateProps> = ({
  message,
  chatUsername,
  observeIntersectionForBottom,
  observeIntersectionForMedia,
  observeIntersectionForAnimatedStickers,
  album,
  noAvatars,
  withAvatar,
  withSenderName,
  areReactionsInMeta,
  noComments,
  appearanceOrder,
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
  canReply,
  lastSyncTime,
  serverTimeOffset,
  highlight,
  animatedEmoji,
  animatedCustomEmoji,
  isInSelectMode,
  isSelected,
  isGroupSelected,
  threadId,
  reactionMessage,
  availableReactions,
  defaultReaction,
  activeReaction,
  activeEmojiInteractions,
  messageListType,
  isPinnedList,
  isDownloading,
  canAutoLoadMedia,
  canAutoPlayMedia,
  shouldLoopStickers,
  autoLoadFileMaxSizeMb,
  threadInfo,
  hasUnreadReaction,
  memoFirstUnreadIdRef,
  animationLevel,
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
  const contentRef = useRef<HTMLDivElement>(null);

  const lang = useLang();

  const [isTranscriptionHidden, setTranscriptionHidden] = useState(false);
  const [hasActiveStickerEffect, startStickerEffect, stopStickerEffect] = useFlag();

  useOnIntersect(bottomMarkerRef, observeIntersectionForBottom);

  const {
    isContextMenuOpen, contextMenuPosition,
    handleBeforeContextMenu, handleContextMenu: onContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref, IS_TOUCH_ENV && isInSelectMode, true, IS_ANDROID);

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
  const { transitionClassNames } = useShowTransition(isShown, undefined, noAppearanceAnimation, false);

  const {
    id: messageId, chatId, forwardInfo, viaBotId, isTranscriptionError,
  } = message;

  const isLocal = isMessageLocal(message);
  const isOwn = isOwnMessage(message);
  const isScheduled = messageListType === 'scheduled' || message.isScheduled;
  const hasReply = isReplyMessage(message) && !shouldHideReply;
  const hasThread = Boolean(threadInfo) && messageListType === 'thread';
  const customShape = getMessageCustomShape(message);
  const hasAnimatedEmoji = customShape && (animatedEmoji || animatedCustomEmoji);
  const hasReactions = reactionMessage?.reactions && !areReactionsEmpty(reactionMessage.reactions);
  const asForwarded = (
    forwardInfo
    && (!isChatWithSelf || isScheduled)
    && !isRepliesChat
    && !forwardInfo.isLinkedChannelPost
    && !customShape
  );
  const isAlbum = Boolean(album) && album!.messages.length > 1
    && !album?.messages.some((msg) => Object.keys(msg.content).length === 0);
  const isInDocumentGroupNotFirst = isInDocumentGroup && !isFirstInDocumentGroup;
  const isInDocumentGroupNotLast = isInDocumentGroup && !isLastInDocumentGroup;
  const isContextMenuShown = contextMenuPosition !== undefined;
  const canShowActionButton = (
    !(isContextMenuShown || isInSelectMode || isForwarding)
    && !isInDocumentGroupNotLast
  );
  const canForward = isChannel && !isScheduled && message.isForwardingAllowed && !isChatProtected;
  const canFocus = Boolean(isPinnedList
    || (forwardInfo
      && (forwardInfo.isChannelPost || (isChatWithSelf && !isOwn) || isRepliesChat)
      && forwardInfo.fromMessageId
    ));

  const selectMessage = useCallback((e?: React.MouseEvent<HTMLDivElement, MouseEvent>, groupedId?: string) => {
    toggleMessageSelection({
      messageId,
      groupedId,
      ...(e?.shiftKey && { withShift: true }),
      ...(isAlbum && { childMessageIds: album!.messages.map(({ id }) => id) }),
    });
  }, [toggleMessageSelection, messageId, isAlbum, album]);

  const messageSender = canShowSender ? sender : undefined;
  const withVoiceTranscription = Boolean(!isTranscriptionHidden && (isTranscriptionError || transcribedText));

  const avatarPeer = forwardInfo && (isChatWithSelf || isRepliesChat || !messageSender) ? originSender : messageSender;
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
    isAlbum,
    Boolean(isInSelectMode),
    Boolean(canReply),
    Boolean(isProtected),
    onContextMenu,
    handleBeforeContextMenu,
    chatId,
    isContextMenuShown,
    contentRef,
    isOwn,
    isInDocumentGroupNotLast,
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
    handleReadMedia,
    handleCancelUpload,
    handleVoteSend,
    handleGroupForward,
    handleForward,
    handleFocus,
    handleFocusForwarded,
    handleDocumentGroupSelectAll,
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
    isProtected && 'is-protected',
    isLastInGroup && 'last-in-group',
    isFirstInDocumentGroup && 'first-in-document-group',
    isLastInDocumentGroup && 'last-in-document-group',
    isLastInList && 'last-in-list',
    isOwn && 'own',
    Boolean(message.views) && 'has-views',
    message.isEdited && 'was-edited',
    hasReply && 'has-reply',
    isContextMenuShown && 'has-menu-open',
    isFocused && !noFocusHighlight && 'focused',
    isForwarding && 'is-forwarding',
    message.isDeleting && 'is-deleting',
    isInDocumentGroup && 'is-in-document-group',
    isAlbum && 'is-album',
    message.hasUnreadMention && 'has-unread-mention',
    isSelected && 'is-selected',
    isInSelectMode && 'is-in-selection-mode',
    isThreadTop && 'is-thread-top',
    Boolean(message.inlineButtons) && 'has-inline-buttons',
    isSwiped && 'is-swiped',
    transitionClassNames,
    (Boolean(activeReaction) || hasActiveStickerEffect) && 'has-active-reaction',
  );

  const {
    text, photo, video, audio, voice, document, sticker, contact, poll, webPage, invoice, location, action, game,
  } = getMessageContent(message);

  const { phoneCall } = action || {};

  const withCommentButton = threadInfo && !isInDocumentGroupNotLast && messageListType === 'thread' && !noComments;
  const withQuickReactionButton = !IS_TOUCH_ENV && !phoneCall && !isInSelectMode && defaultReaction
    && !isInDocumentGroupNotLast;

  const contentClassName = buildContentClassName(message, {
    hasReply,
    customShape,
    isLastInGroup,
    asForwarded,
    hasThread,
    forceSenderName,
    hasComments: threadInfo && threadInfo?.messagesCount > 0,
    hasActionButton: canForward || canFocus,
    hasReactions,
    isGeoLiveActive: location?.type === 'geoLive' && !isGeoLiveExpired(message, getServerTime(serverTimeOffset)),
    withVoiceTranscription,
  });

  const withAppendix = contentClassName.includes('has-appendix');
  const emojiSize = message.emojiOnlyCount && getCustomEmojiSize(message.emojiOnlyCount);
  const textParts = renderMessageText(
    message,
    highlight,
    emojiSize,
    undefined,
    undefined,
    isProtected,
    observeIntersectionForAnimatedStickers,
  );

  let metaPosition!: MetaPosition;
  if (phoneCall) {
    metaPosition = 'none';
  } else if (isInDocumentGroupNotLast) {
    metaPosition = 'none';
  } else if (textParts && !webPage && !hasAnimatedEmoji) {
    metaPosition = 'in-text';
  } else {
    metaPosition = 'standalone';
  }

  let reactionsPosition!: ReactionsPosition;
  if (areReactionsInMeta) {
    reactionsPosition = 'in-meta';
  } else if (hasReactions) {
    if (customShape || ((photo || video) && !textParts)) {
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

  useEnsureMessage(
    isRepliesChat && message.replyToChatId ? message.replyToChatId : chatId,
    hasReply ? message.replyToMessageId : undefined,
    replyMessage,
    message.id,
  );
  useFocusMessage(ref, chatId, isFocused, focusDirection, noFocusHighlight, isResizingContainer);

  useEffect(() => {
    const bottomMarker = bottomMarkerRef.current;
    if (hasUnreadReaction && bottomMarker && isElementInViewport(bottomMarker)) {
      animateUnreadReaction({ messageIds: [messageId] });
    }
  }, [hasUnreadReaction, messageId, animateUnreadReaction]);

  let style = '';
  let calculatedWidth;
  let noMediaCorners = false;
  const albumLayout = useMemo(() => {
    return isAlbum ? calculateAlbumLayout(isOwn, Boolean(asForwarded), Boolean(noAvatars), album!) : undefined;
  }, [isAlbum, isOwn, asForwarded, noAvatars, album]);

  const extraPadding = asForwarded ? 28 : 0;
  if (!isAlbum && (photo || video || invoice?.extendedMedia)) {
    let width: number | undefined;
    if (photo) {
      width = calculateMediaDimensions(message, noAvatars).width;
    } else if (video) {
      if (video.isRound) {
        width = ROUND_VIDEO_DIMENSIONS_PX;
      } else {
        width = calculateMediaDimensions(message, noAvatars).width;
      }
    } else if (invoice?.extendedMedia && (
      invoice.extendedMedia.width && invoice.extendedMedia.height
    )) {
      const { width: previewWidth, height: previewHeight } = invoice.extendedMedia;
      width = calculateDimensionsForMessageMedia({
        width: previewWidth,
        height: previewHeight,
        fromOwnMessage: isOwn,
        isForwarded: isForwarding,
        noAvatars,
      }).width;
    }

    if (width) {
      calculatedWidth = Math.max(getMinMediaWidth(Boolean(text), withCommentButton), width);
      if (calculatedWidth - width > NO_MEDIA_CORNERS_THRESHOLD) {
        noMediaCorners = true;
      }
    }
  } else if (albumLayout) {
    calculatedWidth = Math.max(getMinMediaWidth(Boolean(text), withCommentButton), albumLayout.containerStyle.width);
    if (calculatedWidth - albumLayout.containerStyle.width > NO_MEDIA_CORNERS_THRESHOLD) {
      noMediaCorners = true;
    }
  }

  if (calculatedWidth) {
    style = `width: ${calculatedWidth + extraPadding}px`;
  }

  const signature = (isChannel && message.adminTitle) || (!asForwarded && forwardInfo?.adminTitle) || undefined;
  const metaSafeAuthorWidth = useMemo(() => {
    return signature ? calculateAuthorWidth(signature) : undefined;
  }, [signature]);

  function renderAvatar() {
    const isAvatarPeerUser = avatarPeer && isUserId(avatarPeer.id);
    const avatarUser = (avatarPeer && isAvatarPeerUser) ? avatarPeer as ApiUser : undefined;
    const avatarChat = (avatarPeer && !isAvatarPeerUser) ? avatarPeer as ApiChat : undefined;
    const hiddenName = (!avatarPeer && forwardInfo) ? forwardInfo.hiddenUserName : undefined;

    return (
      <Avatar
        size="small"
        user={avatarUser}
        chat={avatarChat}
        text={hiddenName}
        lastSyncTime={lastSyncTime}
        onClick={(avatarUser || avatarChat) ? handleAvatarClick : undefined}
        observeIntersection={observeIntersectionForMedia}
        animationLevel={animationLevel}
        withVideo
      />
    );
  }

  function renderReactionsAndMeta() {
    const meta = (
      <MessageMeta
        message={message}
        reactionMessage={reactionMessage}
        outgoingStatus={outgoingStatus}
        signature={signature}
        withReactions={reactionsPosition === 'in-meta'}
        withReactionOffset={reactionsPosition === 'inside'}
        availableReactions={availableReactions}
        activeReaction={activeReaction}
        onClick={handleMetaClick}
      />
    );

    if (reactionsPosition !== 'inside') {
      return meta;
    }

    return (
      <Reactions
        activeReaction={activeReaction}
        message={reactionMessage!}
        metaChildren={meta}
        availableReactions={availableReactions}
      />
    );
  }

  function renderContent() {
    const className = buildClassName(
      'content-inner',
      asForwarded && 'forwarded-message',
      hasReply && 'reply-message',
      noMediaCorners && 'no-media-corners',
    );
    const hasCustomAppendix = isLastInGroup && !textParts && !asForwarded && !hasThread;
    const textContentClass = buildClassName(
      'text-content',
      metaPosition === 'in-text' && 'with-meta',
      outgoingStatus && 'with-outgoing-icon',
    );

    return (
      <div className={className} onDoubleClick={handleContentDoubleClick} dir="auto">
        {renderSenderName()}
        {hasReply && (
          <EmbeddedMessage
            message={replyMessage}
            noUserColors={isOwn}
            isProtected={isProtected}
            sender={replyMessageSender}
            observeIntersection={observeIntersectionForMedia}
            onClick={handleReplyClick}
          />
        )}
        {sticker && (
          <Sticker
            message={message}
            observeIntersection={observeIntersectionForMedia}
            observeIntersectionForPlaying={observeIntersectionForAnimatedStickers}
            shouldLoop={shouldLoopStickers}
            lastSyncTime={lastSyncTime}
            shouldPlayEffect={(
              sticker.hasEffect && ((
                memoFirstUnreadIdRef.current && messageId >= memoFirstUnreadIdRef.current
              ) || isLocal)
            ) || undefined}
            onPlayEffect={startStickerEffect}
            onStopEffect={stopStickerEffect}
          />
        )}
        {hasAnimatedEmoji && animatedCustomEmoji && (
          <AnimatedCustomEmoji
            customEmojiId={animatedCustomEmoji}
            withEffects={isUserId(chatId)}
            isOwn={isOwn}
            observeIntersection={observeIntersectionForMedia}
            lastSyncTime={lastSyncTime}
            forceLoadPreview={isLocal}
            messageId={messageId}
            chatId={chatId}
            activeEmojiInteractions={activeEmojiInteractions}
          />
        )}
        {hasAnimatedEmoji && animatedEmoji && (
          <AnimatedEmoji
            emoji={animatedEmoji}
            withEffects={isUserId(chatId)}
            isOwn={isOwn}
            observeIntersection={observeIntersectionForMedia}
            lastSyncTime={lastSyncTime}
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
            observeIntersection={observeIntersectionForMedia}
            isOwn={isOwn}
            isProtected={isProtected}
            hasCustomAppendix={hasCustomAppendix}
            lastSyncTime={lastSyncTime}
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
            observeIntersection={observeIntersectionForMedia}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoadMedia}
            uploadProgress={uploadProgress}
            shouldAffectAppendix={hasCustomAppendix}
            onClick={handleMediaClick}
            onCancelUpload={handleCancelUpload}
            isDownloading={isDownloading}
            isProtected={isProtected}
            theme={theme}
          />
        )}
        {!isAlbum && video && video.isRound && (
          <RoundVideo
            message={message}
            observeIntersection={observeIntersectionForMedia}
            canAutoLoad={canAutoLoadMedia}
            lastSyncTime={lastSyncTime}
            isDownloading={isDownloading}
          />
        )}
        {!isAlbum && video && !video.isRound && (
          <Video
            message={message}
            observeIntersection={observeIntersectionForMedia}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoadMedia}
            canAutoPlay={canAutoPlayMedia}
            uploadProgress={uploadProgress}
            lastSyncTime={lastSyncTime}
            onClick={handleMediaClick}
            onCancelUpload={handleCancelUpload}
            isDownloading={isDownloading}
            isProtected={isProtected}
          />
        )}
        {(audio || voice) && (
          <Audio
            theme={theme}
            message={message}
            origin={AudioOrigin.Inline}
            uploadProgress={uploadProgress}
            lastSyncTime={lastSyncTime}
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
            observeIntersection={observeIntersectionForMedia}
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
            lastSyncTime={lastSyncTime}
          />
        )}
        {invoice?.extendedMedia && (
          <InvoiceMediaPreview
            message={message}
            lastSyncTime={lastSyncTime}
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

        {!hasAnimatedEmoji && textParts && (
          <div className={textContentClass} dir="auto">
            {textParts}
            {metaPosition === 'in-text' && renderReactionsAndMeta()}
          </div>
        )}

        {webPage && (
          <WebPage
            message={message}
            observeIntersection={observeIntersectionForMedia}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoadMedia}
            canAutoPlay={canAutoPlayMedia}
            lastSyncTime={lastSyncTime}
            onMediaClick={handleMediaClick}
            onCancelMediaTransfer={handleCancelUpload}
            isDownloading={isDownloading}
            isProtected={isProtected}
            theme={theme}
          />
        )}
        {invoice && !invoice.extendedMedia && (
          <Invoice
            message={message}
            shouldAffectAppendix={hasCustomAppendix}
            isInSelectMode={isInSelectMode}
            isSelected={isSelected}
            theme={theme}
          />
        )}
        {location && (
          <Location
            message={message}
            lastSyncTime={lastSyncTime}
            isInSelectMode={isInSelectMode}
            isSelected={isSelected}
            theme={theme}
            peer={sender}
            serverTimeOffset={serverTimeOffset}
          />
        )}
      </div>
    );
  }

  function renderSenderName() {
    const media = photo || video || location;
    const shouldRender = !(customShape && !viaBotId) && (
      (withSenderName && !media) || asForwarded || viaBotId || forceSenderName
    ) && !isInDocumentGroupNotFirst && !(hasReply && customShape);

    if (!shouldRender) {
      return undefined;
    }

    let senderTitle;
    let senderColor;
    if (senderPeer && !(customShape && viaBotId)) {
      senderTitle = getSenderTitle(lang, senderPeer);

      if (!asForwarded) {
        senderColor = `color-${getUserColorKey(senderPeer)}`;
      }
    } else if (forwardInfo?.hiddenUserName) {
      senderTitle = forwardInfo.hiddenUserName;
    }
    const senderEmojiStatus = senderPeer && 'emojiStatus' in senderPeer && senderPeer.emojiStatus;
    const senderIsPremium = senderPeer && 'isPremium' in senderPeer && senderPeer.isPremium;

    return (
      <div className="message-title" dir="ltr">
        {senderTitle ? (
          <span
            className={buildClassName('message-title-name interactive', senderColor)}
            onClick={handleSenderClick}
            dir="ltr"
          >
            {renderText(senderTitle)}
            {!asForwarded && senderEmojiStatus && (
              <CustomEmoji
                documentId={senderEmojiStatus.documentId}
                loopLimit={EMOJI_STATUS_LOOP_LIMIT}
                observeIntersection={observeIntersectionForMedia}
                observeIntersectionForPlaying={observeIntersectionForAnimatedStickers}
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
              {renderText(`@${botSender.username}`)}
            </span>
          </>
        )}
        {forwardInfo?.isLinkedChannelPost ? (
          <span className="admin-title" dir="auto">{lang('DiscussChannel')}</span>
        ) : message.adminTitle && !isChannel ? (
          <span className="admin-title" dir="auto">{message.adminTitle}</span>
        ) : undefined}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      id={getMessageHtmlId(message.id)}
      className={containerClassName}
      style={metaSafeAuthorWidth ? `--meta-safe-author-width: ${metaSafeAuthorWidth}px` : undefined}
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
        data-has-unread-mention={message.hasUnreadMention || undefined}
        data-has-unread-reaction={hasUnreadReaction || undefined}
      />
      {!isInDocumentGroup && (
        <div className="message-select-control">
          {isSelected && <i className="icon-select" />}
        </div>
      )}
      {isLastInDocumentGroup && (
        <div
          className={buildClassName('message-select-control group-select', isGroupSelected && 'is-selected')}
          onClick={handleDocumentGroupSelectAll}
        >
          {isGroupSelected && (
            <i className="icon-select" />
          )}
        </div>
      )}
      {withAvatar && renderAvatar()}
      <div
        className={buildClassName('message-content-wrapper', contentClassName.includes('text') && 'can-select-text')}
      >
        <div
          ref={contentRef}
          className={contentClassName}
          style={style}
          dir="auto"
        >
          {asForwarded && !isInDocumentGroupNotFirst && (
            <div className="message-title">{lang('ForwardedMessage')}</div>
          )}
          {renderContent()}
          {!isInDocumentGroupNotLast && metaPosition === 'standalone' && renderReactionsAndMeta()}
          {canShowActionButton && canForward ? (
            <Button
              className="message-action-button"
              color="translucent-white"
              round
              size="tiny"
              ariaLabel={lang('lng_context_forward_msg')}
              onClick={isLastInDocumentGroup ? handleGroupForward : handleForward}
            >
              <i className="icon-share-filled" />
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
              <i className="icon-arrow-right" />
            </Button>
          ) : undefined}
          {withCommentButton && <CommentButton threadInfo={threadInfo!} disabled={noComments} />}
          {withAppendix && (
            <div className="svg-appendix" dangerouslySetInnerHTML={isOwn ? APPENDIX_OWN : APPENDIX_NOT_OWN} />
          )}
          {withQuickReactionButton && (
            <div
              className={buildClassName('quick-reaction', isQuickReactionVisible && !activeReaction && 'visible')}
              onClick={handleSendQuickReaction}
            >
              <ReactionStaticEmoji reaction={defaultReaction!} />
            </div>
          )}
        </div>
        {message.inlineButtons && (
          <InlineButtons message={message} onClick={clickBotInlineButton} />
        )}
        {reactionsPosition === 'outside' && (
          <Reactions
            message={reactionMessage!}
            isOutside
            activeReaction={activeReaction}
            availableReactions={availableReactions}
          />
        )}
      </div>
      {contextMenuPosition && (
        <ContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuPosition}
          message={message}
          album={album}
          chatUsername={chatUsername}
          messageListType={messageListType}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, ownProps): StateProps => {
    const {
      focusedMessage, forwardMessages, lastSyncTime, serverTimeOffset,
    } = global;
    const {
      message, album, withSenderName, withAvatar, threadId, messageListType, isLastInDocumentGroup,
    } = ownProps;
    const {
      id, chatId, viaBotId, replyToChatId, replyToMessageId, isOutgoing, threadInfo, forwardInfo, transcriptionId,
    } = message;

    const chat = selectChat(global, chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isRepliesChat = isChatWithRepliesBot(chatId);
    const isChannel = chat && isChatChannel(chat);
    const chatUsername = chat?.username;

    const forceSenderName = !isChatWithSelf && isAnonymousOwnMessage(message);
    const canShowSender = withSenderName || withAvatar || forceSenderName;
    const sender = selectSender(global, message);
    const originSender = selectForwardedSender(global, message);
    const botSender = viaBotId ? selectUser(global, viaBotId) : undefined;

    const threadTopMessageId = threadId ? selectThreadTopMessageId(global, chatId, threadId) : undefined;
    const isThreadTop = message.id === threadTopMessageId;

    const shouldHideReply = replyToMessageId === threadTopMessageId;
    const replyMessage = replyToMessageId && !shouldHideReply
      ? selectChatMessage(global, isRepliesChat && replyToChatId ? replyToChatId : chatId, replyToMessageId)
      : undefined;
    const replyMessageSender = replyMessage && selectReplySender(global, replyMessage, Boolean(forwardInfo));

    const uploadProgress = selectUploadProgress(global, message);
    const isFocused = messageListType === 'thread' && (
      album
        ? album.messages.some((m) => selectIsMessageFocused(global, m))
        : selectIsMessageFocused(global, message)
    );

    const {
      direction: focusDirection, noHighlight: noFocusHighlight, isResizingContainer,
    } = (isFocused && focusedMessage) || {};

    const isForwarding = forwardMessages.messageIds && forwardMessages.messageIds.includes(id);

    const { query: highlight } = selectCurrentTextSearch(global) || {};

    const singleEmoji = getMessageSingleRegularEmoji(message);
    const animatedEmoji = singleEmoji && (
      selectAnimatedEmoji(global, singleEmoji) || selectLocalAnimatedEmoji(global, singleEmoji)
    ) ? singleEmoji : undefined;
    const animatedCustomEmoji = getMessageSingleCustomEmoji(message);

    let isSelected: boolean;
    if (album?.messages) {
      isSelected = album.messages.every(({ id: messageId }) => selectIsMessageSelected(global, messageId));
    } else {
      isSelected = selectIsMessageSelected(global, id);
    }

    const { canReply } = (messageListType === 'thread' && selectAllowedMessageActions(global, message, threadId)) || {};
    const isDownloading = selectIsDownloading(global, message);
    const actualThreadInfo = threadInfo
      ? selectThreadInfo(global, threadInfo.chatId, threadInfo.threadId) || threadInfo
      : undefined;

    const isInDocumentGroup = Boolean(message.groupedId) && !message.isInAlbum;
    const documentGroupFirstMessageId = isInDocumentGroup
      ? selectMessageIdsByGroupId(global, chatId, message.groupedId!)![0]
      : undefined;
    const reactionMessage = isInDocumentGroup ? (
      isLastInDocumentGroup ? selectChatMessage(global, chatId, documentGroupFirstMessageId!) : undefined
    ) : message;

    const hasUnreadReaction = chat?.unreadReactions?.includes(message.id);

    return {
      theme: selectTheme(global),
      chatUsername,
      forceSenderName,
      sender,
      canShowSender,
      originSender,
      botSender,
      shouldHideReply,
      isThreadTop,
      replyMessage,
      replyMessageSender,
      isInDocumentGroup,
      isProtected: selectIsMessageProtected(global, message),
      isChatProtected: selectIsChatProtected(global, chatId),
      isFocused,
      isForwarding,
      reactionMessage,
      isChatWithSelf,
      isRepliesChat,
      isChannel,
      canReply,
      lastSyncTime,
      serverTimeOffset,
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
      canAutoLoadMedia: selectCanAutoLoadMedia(global, message),
      canAutoPlayMedia: selectCanAutoPlayMedia(global, message),
      autoLoadFileMaxSizeMb: global.settings.byKey.autoLoadFileMaxSizeMb,
      shouldLoopStickers: selectShouldLoopStickers(global),
      threadInfo: actualThreadInfo,
      availableReactions: global.availableReactions,
      defaultReaction: isMessageLocal(message) ? undefined : selectDefaultReaction(global, chatId),
      activeReaction: reactionMessage && global.activeReactions[reactionMessage.id],
      activeEmojiInteractions: global.activeEmojiInteractions,
      ...(isOutgoing && { outgoingStatus: selectOutgoingStatus(global, message, messageListType === 'scheduled') }),
      ...(typeof uploadProgress === 'number' && { uploadProgress }),
      ...(isFocused && { focusDirection, noFocusHighlight, isResizingContainer }),
      hasUnreadReaction,
      isTranscribing: transcriptionId !== undefined && global.transcriptions[transcriptionId]?.isPending,
      transcribedText: transcriptionId !== undefined ? global.transcriptions[transcriptionId]?.text : undefined,
      isPremium: selectIsCurrentUserPremium(global),
      animationLevel: global.settings.byKey.animationLevel,
    };
  },
)(Message));
