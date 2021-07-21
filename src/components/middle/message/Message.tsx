import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions, MessageListType } from '../../../global/types';
import {
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiUser,
  ApiChat,
  ApiSticker,
  MAIN_THREAD_ID,
} from '../../../api/types';
import {
  FocusDirection, IAlbum, ISettings, MediaViewerOrigin,
} from '../../../types';

import { IS_ANDROID } from '../../../util/environment';
import { pick } from '../../../util/iteratees';
import {
  selectChat,
  selectChatMessage,
  selectUploadProgress,
  selectIsChatWithSelf,
  selectOutgoingStatus,
  selectUser,
  selectIsMessageFocused,
  selectCurrentTextSearch,
  selectAnimatedEmoji,
  selectIsInSelectMode,
  selectIsMessageSelected,
  selectIsDocumentGroupSelected,
  selectSender,
  selectForwardedSender,
  selectThreadTopMessageId,
  selectShouldAutoLoadMedia,
  selectShouldAutoPlayMedia,
  selectShouldLoopStickers,
  selectTheme,
} from '../../../modules/selectors';
import {
  getMessageContent,
  isOwnMessage,
  isReplyMessage,
  isAnonymousOwnMessage,
  isMessageLocal,
  isChatPrivate,
  getMessageCustomShape,
  isChatChannel,
  getMessageSingleEmoji,
  getSenderTitle,
  getUserColorKey,
} from '../../../modules/helpers';
import buildClassName from '../../../util/buildClassName';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { renderMessageText } from '../../common/helpers/renderMessageText';
import { ROUND_VIDEO_DIMENSIONS } from '../../common/helpers/mediaDimensions';
import { buildContentClassName, isEmojiOnlyMessage } from './helpers/buildContentClassName';
import { getMinMediaWidth, calculateMediaDimensions } from './helpers/mediaDimensions';
import { calculateAlbumLayout } from './helpers/calculateAlbumLayout';
import { preventMessageInputBlur } from '../helpers/preventMessageInputBlur';
import renderText from '../../common/helpers/renderText';
import calculateAuthorWidth from './helpers/calculateAuthorWidth';
import { ObserveFn, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useFocusMessage from './hooks/useFocusMessage';
import useLang from '../../../hooks/useLang';
import useShowTransition from '../../../hooks/useShowTransition';
import useFlag from '../../../hooks/useFlag';

import Button from '../../ui/Button';
import Avatar from '../../common/Avatar';
import EmbeddedMessage from '../../common/EmbeddedMessage';
import Document from '../../common/Document';
import Audio from '../../common/Audio';
import MessageMeta from './MessageMeta';
import ContextMenuContainer from './ContextMenuContainer.async';
import Sticker from './Sticker';
import AnimatedEmoji from '../../common/AnimatedEmoji';
import Photo from './Photo';
import Video from './Video';
import Contact from './Contact';
import Poll from './Poll';
import WebPage from './WebPage';
import Invoice from './Invoice';
import Album from './Album';
import RoundVideo from './RoundVideo';
import InlineButtons from './InlineButtons';
import CommentButton from './CommentButton';

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
  observeIntersectionForBottom: ObserveFn;
  observeIntersectionForMedia: ObserveFn;
  observeIntersectionForAnimatedStickers: ObserveFn;
  album?: IAlbum;
  noAvatars?: boolean;
  withAvatar?: boolean;
  withSenderName?: boolean;
  threadId: number;
  messageListType: MessageListType;
  noComments: boolean;
  appearanceOrder: number;
} & MessagePositionProperties;

type StateProps = {
  theme: ISettings['theme'];
  forceSenderName?: boolean;
  sender?: ApiUser | ApiChat;
  originSender?: ApiUser | ApiChat;
  botSender?: ApiUser;
  isThreadTop?: boolean;
  shouldHideReply?: boolean;
  replyMessage?: ApiMessage;
  replyMessageSender?: ApiUser | ApiChat;
  outgoingStatus?: ApiMessageOutgoingStatus;
  uploadProgress?: number;
  isFocused?: boolean;
  focusDirection?: FocusDirection;
  noFocusHighlight?: boolean;
  isForwarding?: boolean;
  isChatWithSelf?: boolean;
  isChannel?: boolean;
  lastSyncTime?: number;
  highlight?: string;
  isSingleEmoji?: boolean;
  animatedEmoji?: ApiSticker;
  isInSelectMode?: boolean;
  isSelected?: boolean;
  isGroupSelected?: boolean;
  threadId?: number;
  isPinnedList?: boolean;
  shouldAutoLoadMedia?: boolean;
  shouldAutoPlayMedia?: boolean;
  shouldLoopStickers?: boolean;
};

type DispatchProps = Pick<GlobalActions, (
  'focusMessage' | 'openMediaViewer' | 'openAudioPlayer' |
  'openUserInfo' | 'openChat' |
  'cancelSendingMessage' | 'markMessagesRead' |
  'sendPollVote' | 'toggleMessageSelection' | 'setReplyingToId' | 'openForwardMenu' |
  'clickInlineButton' | 'disableContextMenuHint' | 'showNotification'
)>;

const NBSP = '\u00A0';
const GROUP_MESSAGE_HOVER_ATTRIBUTE = 'data-is-document-group-hover';
// eslint-disable-next-line max-len
const APPENDIX_OWN = '<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"/><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"/></filter></defs><g fill="none" fill-rule="evenodd"><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#000" filter="url(#a)"/><path d="M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z" fill="#EEFFDE" class="corner"/></g></svg>';
// eslint-disable-next-line max-len
const APPENDIX_NOT_OWN = '<svg width="9" height="20" xmlns="http://www.w3.org/2000/svg"><defs><filter x="-50%" y="-14.7%" width="200%" height="141.2%" filterUnits="objectBoundingBox" id="a"><feOffset dy="1" in="SourceAlpha" result="shadowOffsetOuter1"/><feGaussianBlur stdDeviation="1" in="shadowOffsetOuter1" result="shadowBlurOuter1"/><feColorMatrix values="0 0 0 0 0.0621962482 0 0 0 0 0.138574144 0 0 0 0 0.185037364 0 0 0 0.15 0" in="shadowBlurOuter1"/></filter></defs><g fill="none" fill-rule="evenodd"><path d="M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z" fill="#000" filter="url(#a)"/><path d="M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z" fill="#FFF" class="corner"/></g></svg>';
const APPEARANCE_DELAY = 10;
const NO_MEDIA_CORNERS_THRESHOLD = 18;
const ANDROID_KEYBOARD_HIDE_DELAY_MS = 150;

const Message: FC<OwnProps & StateProps & DispatchProps> = ({
  message,
  observeIntersectionForBottom,
  observeIntersectionForMedia,
  observeIntersectionForAnimatedStickers,
  album,
  noAvatars,
  withAvatar,
  withSenderName,
  noComments,
  appearanceOrder,
  isFirstInGroup,
  isLastInGroup,
  isFirstInDocumentGroup,
  isLastInDocumentGroup,
  isLastInList,
  theme,
  forceSenderName,
  sender,
  originSender,
  botSender,
  isThreadTop,
  shouldHideReply,
  replyMessage,
  replyMessageSender,
  outgoingStatus,
  uploadProgress,
  isFocused,
  focusDirection,
  noFocusHighlight,
  isForwarding,
  isChatWithSelf,
  isChannel,
  lastSyncTime,
  highlight,
  animatedEmoji,
  isInSelectMode,
  isSelected,
  isGroupSelected,
  threadId,
  messageListType,
  isPinnedList,
  shouldAutoLoadMedia,
  shouldAutoPlayMedia,
  shouldLoopStickers,
  focusMessage,
  openMediaViewer,
  openAudioPlayer,
  openUserInfo,
  openChat,
  cancelSendingMessage,
  markMessagesRead,
  sendPollVote,
  toggleMessageSelection,
  setReplyingToId,
  openForwardMenu,
  clickInlineButton,
  disableContextMenuHint,
  showNotification,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const bottomMarkerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const appendixRef = useRef<HTMLDivElement>(null);
  const lang = useLang();


  useOnIntersect(bottomMarkerRef, observeIntersectionForBottom);

  const {
    isContextMenuOpen, contextMenuPosition,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref, false, true);

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

  const { chatId, id: messageId, threadInfo } = message;

  const isLocal = isMessageLocal(message);
  const isOwn = isOwnMessage(message);
  const isScheduled = messageListType === 'scheduled' || message.isScheduled;
  const hasReply = isReplyMessage(message) && !shouldHideReply;
  const hasThread = Boolean(threadInfo) && messageListType === 'thread';
  const { forwardInfo, viaBotId } = message;
  const asForwarded = forwardInfo && !isChatWithSelf && !forwardInfo.isLinkedChannelPost;
  const isInDocumentGroup = !!message.groupedId && !message.isInAlbum;
  const isAlbum = Boolean(album) && album!.messages.length > 1;
  const {
    text, photo, video, audio, voice, document, sticker, contact, poll, webPage, invoice,
  } = getMessageContent(message);
  const customShape = getMessageCustomShape(message);
  const textParts = renderMessageText(message, highlight, isEmojiOnlyMessage(customShape));
  const isContextMenuShown = contextMenuPosition !== undefined;
  const signature = (
    (isChannel && message.adminTitle) || (forwardInfo && !asForwarded && forwardInfo.adminTitle) || undefined
  );
  const metaSafeAuthorWidth = useMemo(() => {
    return signature ? calculateAuthorWidth(signature) : undefined;
  }, [signature]);
  const canShowActionButton = (
    !(isContextMenuShown || isInSelectMode || isForwarding)
    && (!isInDocumentGroup || isLastInDocumentGroup)
  );
  const canForward = canShowActionButton && isChannel && !isScheduled;
  const canFocus = Boolean(canShowActionButton && (
    (forwardInfo && (forwardInfo.isChannelPost || (isChatWithSelf && !isOwn)) && forwardInfo.fromMessageId)
    || isPinnedList
  ));
  const avatarPeer = forwardInfo && (isChatWithSelf || !sender) ? originSender : sender;
  const senderPeer = forwardInfo ? originSender : sender;

  const containerClassName = buildClassName(
    'Message message-list-item',
    isFirstInGroup && 'first-in-group',
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
    transitionClassNames,
  );
  const contentClassName = buildContentClassName(message, {
    hasReply,
    customShape,
    isLastInGroup,
    asForwarded,
    hasThread,
    forceSenderName,
    hasComments: message.threadInfo && message.threadInfo.messagesCount > 0,
  });
  const withCommentButton = message.threadInfo && (!isInDocumentGroup || isLastInDocumentGroup)
    && messageListType === 'thread' && !noComments;
  const withAppendix = contentClassName.includes('has-appendix');

  useEnsureMessage(chatId, hasReply ? message.replyToMessageId : undefined, replyMessage, message.id);
  useFocusMessage(ref, chatId, isFocused, focusDirection, noFocusHighlight);
  useLayoutEffect(() => {
    if (!appendixRef.current) {
      return;
    }

    appendixRef.current.innerHTML = isOwn ? APPENDIX_OWN : APPENDIX_NOT_OWN;
  }, [isOwn, withAppendix]);

  const handleGroupDocumentMessagesSelect = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();

    toggleMessageSelection({
      messageId,
      groupedId: message.groupedId,
    });
  }, [messageId, message.groupedId, toggleMessageSelection]);

  const handleMessageSelect = useCallback((e?: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (isLocal) {
      return;
    }

    const params = isAlbum && album && album.messages
      ? {
        messageId,
        childMessageIds: album.messages.map(({ id }) => id),
        withShift: e && e.shiftKey,
      }
      : { messageId, withShift: e && e.shiftKey };
    toggleMessageSelection(params);
  }, [isLocal, isAlbum, album, messageId, toggleMessageSelection]);

  const handleContainerDoubleClick = useCallback(() => {
    setReplyingToId({ messageId });
  }, [setReplyingToId, messageId]);

  const handleContentDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    preventMessageInputBlur(e);

    if (!isLocal) {
      handleBeforeContextMenu(e);
    }
  };

  const handleAvatarClick = useCallback(() => {
    if (!avatarPeer) {
      return;
    }

    if (isChatPrivate(avatarPeer.id)) {
      openUserInfo({ id: avatarPeer.id });
    } else {
      openChat({ id: avatarPeer.id });
    }
  }, [avatarPeer, openUserInfo, openChat]);

  const handleSenderClick = useCallback(() => {
    if (!senderPeer) {
      showNotification({ message: lang('HidAccount') });

      return;
    }

    if (isChatPrivate(senderPeer.id)) {
      openUserInfo({ id: senderPeer.id });
    } else {
      openChat({ id: senderPeer.id });
    }
  }, [senderPeer, showNotification, lang, openUserInfo, openChat]);

  const handleViaBotClick = useCallback(() => {
    if (!botSender) {
      return;
    }

    openUserInfo({ id: botSender.id });
  }, [botSender, openUserInfo]);

  const handleReplyClick = useCallback((): void => {
    focusMessage({
      chatId, threadId, messageId: message.replyToMessageId, replyMessageId: messageId,
    });
  }, [focusMessage, chatId, threadId, message.replyToMessageId, messageId]);

  const handleMediaClick = useCallback((): void => {
    openMediaViewer({
      chatId, threadId, messageId, origin: isScheduled ? MediaViewerOrigin.ScheduledInline : MediaViewerOrigin.Inline,
    });
  }, [chatId, threadId, messageId, openMediaViewer, isScheduled]);

  const handleAudioPlay = useCallback((): void => {
    openAudioPlayer({ chatId, messageId });
  }, [chatId, messageId, openAudioPlayer]);

  const handleAlbumMediaClick = useCallback((albumMessageId: number): void => {
    openMediaViewer({
      chatId,
      threadId,
      messageId: albumMessageId,
      origin: isScheduled ? MediaViewerOrigin.ScheduledAlbum : MediaViewerOrigin.Album,
    });
  }, [chatId, threadId, openMediaViewer, isScheduled]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const target = e.target as HTMLDivElement;
    if (!target.classList.contains('text-content') && !target.classList.contains('Message')) {
      return;
    }

    if (IS_ANDROID) {
      setTimeout(() => {
        handleContextMenu(e);
      }, ANDROID_KEYBOARD_HIDE_DELAY_MS);
    } else {
      handleContextMenu(e);
    }
  }, [handleContextMenu]);

  const handleReadMedia = useCallback((): void => {
    markMessagesRead({ messageIds: [messageId] });
  }, [messageId, markMessagesRead]);

  const handleCancelUpload = useCallback(() => {
    cancelSendingMessage({ chatId, messageId });
  }, [cancelSendingMessage, chatId, messageId]);

  const handleVoteSend = useCallback((options: string[]) => {
    sendPollVote({ chatId, messageId, options });
  }, [chatId, messageId, sendPollVote]);

  const handleGroupForward = useCallback(() => {
    openForwardMenu({ fromChatId: chatId, groupedId: message.groupedId });
  }, [openForwardMenu, chatId, message.groupedId]);

  const handleForward = useCallback(() => {
    if (album && album.messages) {
      const messageIds = album.messages.map(({ id }) => id);
      openForwardMenu({ fromChatId: chatId, messageIds });
    } else {
      openForwardMenu({ fromChatId: chatId, messageIds: [messageId] });
    }
  }, [album, openForwardMenu, chatId, messageId]);

  const handleFocus = useCallback(() => {
    focusMessage({
      chatId, threadId: MAIN_THREAD_ID, messageId,
    });
  }, [focusMessage, chatId, messageId]);

  const handleFocusForwarded = useCallback(() => {
    if (isInDocumentGroup) {
      focusMessage({
        chatId: forwardInfo!.fromChatId, groupedId: message.groupedId, groupedChatId: chatId,
      });
      return;
    }
    focusMessage({
      chatId: forwardInfo!.fromChatId, messageId: forwardInfo!.fromMessageId,
    });
  }, [focusMessage, forwardInfo, message, chatId, isInDocumentGroup]);

  let style = '';
  let calculatedWidth;
  let noMediaCorners = false;
  const albumLayout = useMemo(() => {
    return isAlbum ? calculateAlbumLayout(isOwn, Boolean(asForwarded), Boolean(noAvatars), album!) : undefined;
  }, [isAlbum, isOwn, asForwarded, noAvatars, album]);

  const extraPadding = asForwarded ? 28 : 0;
  if (!isAlbum && (photo || video)) {
    let width: number | undefined;
    if (photo) {
      width = calculateMediaDimensions(message, noAvatars).width;
    } else if (video) {
      if (video.isRound) {
        width = ROUND_VIDEO_DIMENSIONS;
      } else {
        width = calculateMediaDimensions(message, noAvatars).width;
      }
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

  function renderAvatar() {
    const isAvatarPeerUser = avatarPeer && isChatPrivate(avatarPeer.id);
    const avatarUser = avatarPeer && isAvatarPeerUser ? avatarPeer as ApiUser : undefined;
    const avatarChat = avatarPeer && !isAvatarPeerUser ? avatarPeer as ApiChat : undefined;
    const hiddenName = !avatarPeer && forwardInfo ? forwardInfo.hiddenUserName : undefined;

    return (
      <Avatar
        size="small"
        user={avatarUser}
        chat={avatarChat}
        text={hiddenName}
        lastSyncTime={lastSyncTime}
        onClick={(avatarUser || avatarChat) ? handleAvatarClick : undefined}
      />
    );
  }

  function renderContent() {
    const className = buildClassName(
      'content-inner',
      asForwarded && !customShape && 'forwarded-message',
      hasReply && 'reply-message',
      noMediaCorners && 'no-media-corners',
    );
    const hasCustomAppendix = isLastInGroup && !textParts && !asForwarded && !hasThread;
    const shouldInlineMeta = !webPage && !animatedEmoji && textParts;

    return (
      <div className={className} onDoubleClick={handleContentDoubleClick} dir="auto">
        {renderSenderName()}
        {hasReply && (
          <EmbeddedMessage
            message={replyMessage}
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
          />
        )}
        {animatedEmoji && (
          <AnimatedEmoji
            isInline
            sticker={animatedEmoji}
            observeIntersection={observeIntersectionForMedia}
            lastSyncTime={lastSyncTime}
            forceLoadPreview={isLocal}
          />
        )}
        {isAlbum && (
          <Album
            album={album!}
            albumLayout={albumLayout!}
            observeIntersection={observeIntersectionForMedia}
            shouldAutoLoad={shouldAutoLoadMedia}
            shouldAutoPlay={shouldAutoPlayMedia}
            isOwn={isOwn}
            hasCustomAppendix={hasCustomAppendix}
            lastSyncTime={lastSyncTime}
            onMediaClick={handleAlbumMediaClick}
          />
        )}
        {!isAlbum && photo && (
          <Photo
            message={message}
            observeIntersection={observeIntersectionForMedia}
            noAvatars={noAvatars}
            shouldAutoLoad={shouldAutoLoadMedia}
            uploadProgress={uploadProgress}
            shouldAffectAppendix={hasCustomAppendix}
            onClick={handleMediaClick}
            onCancelUpload={handleCancelUpload}
          />
        )}
        {!isAlbum && video && video.isRound && (
          <RoundVideo
            message={message}
            observeIntersection={observeIntersectionForMedia}
            shouldAutoLoad={shouldAutoLoadMedia}
            shouldAutoPlay={shouldAutoPlayMedia}
            lastSyncTime={lastSyncTime}
          />
        )}
        {!isAlbum && video && !video.isRound && (
          <Video
            message={message}
            observeIntersection={observeIntersectionForMedia}
            noAvatars={noAvatars}
            shouldAutoLoad={shouldAutoLoadMedia}
            shouldAutoPlay={shouldAutoPlayMedia}
            uploadProgress={uploadProgress}
            lastSyncTime={lastSyncTime}
            onClick={handleMediaClick}
            onCancelUpload={handleCancelUpload}
          />
        )}
        {(audio || voice) && (
          <Audio
            theme={theme}
            message={message}
            uploadProgress={uploadProgress}
            lastSyncTime={lastSyncTime}
            isSelectable={isInDocumentGroup}
            isSelected={isSelected}
            onPlay={handleAudioPlay}
            onReadMedia={voice && (!isOwn || isChatWithSelf) ? handleReadMedia : undefined}
            onCancelUpload={handleCancelUpload}
          />
        )}
        {document && (
          <Document
            message={message}
            observeIntersection={observeIntersectionForMedia}
            uploadProgress={uploadProgress}
            isSelectable={isInDocumentGroup}
            isSelected={isSelected}
            onMediaClick={handleMediaClick}
            onCancelUpload={handleCancelUpload}
          />
        )}
        {contact && (
          <Contact contact={contact} />
        )}
        {poll && (
          <Poll message={message} poll={poll} onSendVote={handleVoteSend} />
        )}
        {!animatedEmoji && textParts && (
          <p className={`text-content ${shouldInlineMeta ? 'with-meta' : ''}`} dir="auto">
            {textParts}
            {shouldInlineMeta && (
              <MessageMeta
                message={message}
                outgoingStatus={outgoingStatus}
                signature={signature}
                onClick={handleMessageSelect}
              />
            )}
          </p>
        )}
        {webPage && (
          <WebPage
            message={message}
            observeIntersection={observeIntersectionForMedia}
            noAvatars={noAvatars}
            shouldAutoLoad={shouldAutoLoadMedia}
            shouldAutoPlay={shouldAutoPlayMedia}
            lastSyncTime={lastSyncTime}
            onMediaClick={handleMediaClick}
            onCancelMediaTransfer={handleCancelUpload}
          />
        )}
        {invoice && (
          <Invoice
            message={message}
          />
        )}
      </div>
    );
  }

  function renderSenderName() {
    const shouldRender = !(customShape && !viaBotId) && (
      (withSenderName && !photo && !video) || asForwarded || viaBotId || forceSenderName
    ) && (!isInDocumentGroup || isFirstInDocumentGroup);

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
    } else if (forwardInfo && forwardInfo.hiddenUserName) {
      senderTitle = forwardInfo.hiddenUserName;
    }

    return (
      <div className="message-title" dir="ltr">
        {senderTitle ? (
          <span
            className={buildClassName('interactive', senderColor)}
            onClick={handleSenderClick}
            dir="auto"
          >
            {renderText(senderTitle)}
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
        {forwardInfo && forwardInfo.isLinkedChannelPost ? (
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
      id={`message${messageId}`}
      className={containerClassName}
      // @ts-ignore teact feature
      style={metaSafeAuthorWidth ? `--meta-safe-author-width: ${metaSafeAuthorWidth}px` : undefined}
      data-message-id={messageId}
      onClick={isInSelectMode ? handleMessageSelect : IS_ANDROID ? handleClick : undefined}
      onDoubleClick={!isInSelectMode ? handleContainerDoubleClick : undefined}
      onMouseDown={!isInSelectMode ? handleMouseDown : undefined}
      onContextMenu={!isInSelectMode && !isLocal ? handleContextMenu : undefined}
      onMouseEnter={isInDocumentGroup && !isLastInDocumentGroup ? handleDocumentGroupMouseEnter : undefined}
      onMouseLeave={isInDocumentGroup && !isLastInDocumentGroup ? handleDocumentGroupMouseLeave : undefined}
    >
      <div
        ref={bottomMarkerRef}
        className="bottom-marker"
        data-message-id={messageId}
        data-last-message-id={album ? album.messages[album.messages.length - 1].id : undefined}
        data-has-unread-mention={message.hasUnreadMention}
      />
      {!isLocal && !isInDocumentGroup && (
        <div className="message-select-control">
          {isSelected && <i className="icon-select" />}
        </div>
      )}
      {!isLocal && isLastInDocumentGroup && (
        <div
          className={buildClassName('message-select-control group-select', isGroupSelected && 'is-selected')}
          onClick={handleGroupDocumentMessagesSelect}
        >
          {isGroupSelected && (
            <i className="icon-select" />
          )}
        </div>
      )}
      {withAvatar && renderAvatar()}
      <div
        className="message-content-wrapper"
        onClick={isInSelectMode && isInDocumentGroup ? handleMessageSelect : undefined}
      >
        <div
          className={contentClassName}
          // @ts-ignore
          style={style}
          dir="auto"
        >
          {asForwarded && !customShape && (!isInDocumentGroup || isFirstInDocumentGroup) && (
            <div className="message-title">{lang('ForwardedMessage')}</div>
          )}
          {renderContent()}
          {(!isInDocumentGroup || isLastInDocumentGroup) && !(!webPage && !animatedEmoji && textParts) && (
            <MessageMeta
              message={message}
              outgoingStatus={outgoingStatus}
              signature={signature}
              onClick={handleMessageSelect}
            />
          )}
          {canForward ? (
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
          ) : canFocus ? (
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
          {withCommentButton && <CommentButton message={message} disabled={noComments} />}
          {withAppendix && <div className="svg-appendix" ref={appendixRef} />}
        </div>
        {message.inlineButtons && (
          <InlineButtons message={message} onClick={clickInlineButton} />
        )}
      </div>
      {contextMenuPosition && (
        <ContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuPosition}
          message={message}
          album={album}
          messageListType={messageListType}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        />
      )}
    </div>
  );
};

function handleDocumentGroupMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
  const lastGroupElement = getLastElementInDocumentGroup(e.currentTarget);
  if (lastGroupElement) {
    lastGroupElement.setAttribute(GROUP_MESSAGE_HOVER_ATTRIBUTE, '');
  }
}

function handleDocumentGroupMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
  const lastGroupElement = getLastElementInDocumentGroup(e.currentTarget);
  if (lastGroupElement) {
    lastGroupElement.removeAttribute(GROUP_MESSAGE_HOVER_ATTRIBUTE);
  }
}

function getLastElementInDocumentGroup(element: Element) {
  let current: Element | null = element;

  do {
    current = current.nextElementSibling;
  } while (current && !current.classList.contains('last-in-document-group'));

  return current;
}

export default memo(withGlobal<OwnProps>(
  (global, ownProps): StateProps => {
    const { focusedMessage, forwardMessages, lastSyncTime } = global;
    const {
      message, album, withSenderName, withAvatar, threadId, messageListType,
    } = ownProps;
    const {
      id, chatId, viaBotId, replyToMessageId, isOutgoing,
    } = message;

    const chat = selectChat(global, chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isChannel = chat && isChatChannel(chat);

    const forceSenderName = !isChatWithSelf && isAnonymousOwnMessage(message);
    const canShowSender = withSenderName || withAvatar || forceSenderName;
    const sender = canShowSender ? selectSender(global, message) : undefined;
    const originSender = selectForwardedSender(global, message);
    const botSender = viaBotId ? selectUser(global, viaBotId) : undefined;

    const threadTopMessageId = threadId ? selectThreadTopMessageId(global, chatId, threadId) : undefined;
    const isThreadTop = message.id === threadTopMessageId;

    const shouldHideReply = replyToMessageId === threadTopMessageId;
    const replyMessage = replyToMessageId && !shouldHideReply
      ? selectChatMessage(global, chatId, replyToMessageId)
      : undefined;
    const replyMessageSender = replyMessage && selectSender(global, replyMessage);

    const uploadProgress = selectUploadProgress(global, message);
    const isFocused = messageListType === 'thread' && (
      album
        ? album.messages.some((m) => selectIsMessageFocused(global, m))
        : selectIsMessageFocused(global, message)
    );

    const { direction: focusDirection, noHighlight: noFocusHighlight } = (isFocused && focusedMessage) || {};

    const isForwarding = forwardMessages.messageIds && forwardMessages.messageIds.includes(id);

    const { query: highlight } = selectCurrentTextSearch(global) || {};

    const singleEmoji = getMessageSingleEmoji(message);
    let isSelected: boolean;

    if (album && album.messages) {
      isSelected = album.messages.every(({ id: messageId }) => selectIsMessageSelected(global, messageId));
    } else {
      isSelected = selectIsMessageSelected(global, id);
    }

    return {
      theme: selectTheme(global),
      forceSenderName,
      sender,
      originSender,
      botSender,
      shouldHideReply,
      isThreadTop,
      replyMessage,
      replyMessageSender,
      ...(isOutgoing && { outgoingStatus: selectOutgoingStatus(global, message, messageListType === 'scheduled') }),
      ...(typeof uploadProgress === 'number' && { uploadProgress }),
      isFocused,
      ...(isFocused && { focusDirection, noFocusHighlight }),
      isForwarding,
      isChatWithSelf,
      isChannel,
      lastSyncTime,
      highlight,
      isSingleEmoji: Boolean(singleEmoji),
      animatedEmoji: singleEmoji ? selectAnimatedEmoji(global, singleEmoji) : undefined,
      isInSelectMode: selectIsInSelectMode(global),
      isSelected,
      isGroupSelected: (
        !!message.groupedId && !message.isInAlbum && selectIsDocumentGroupSelected(global, chatId, message.groupedId)
      ),
      threadId,
      isPinnedList: messageListType === 'pinned',
      shouldAutoLoadMedia: chat ? selectShouldAutoLoadMedia(global, message, chat, sender) : undefined,
      shouldAutoPlayMedia: selectShouldAutoPlayMedia(global, message),
      shouldLoopStickers: selectShouldLoopStickers(global),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'focusMessage',
    'openMediaViewer',
    'openAudioPlayer',
    'cancelSendingMessage',
    'openUserInfo',
    'openChat',
    'markMessagesRead',
    'sendPollVote',
    'toggleMessageSelection',
    'setReplyingToId',
    'openForwardMenu',
    'clickInlineButton',
    'disableContextMenuHint',
    'showNotification',
  ]),
)(Message));
