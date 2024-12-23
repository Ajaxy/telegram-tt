import type React from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiMessage, ApiPeer, ApiStory, ApiTopic, ApiUser,
} from '../../../../api/types';
import type { OldLangFn } from '../../../../hooks/useOldLang';
import type { IAlbum, ThreadId } from '../../../../types';
import { MAIN_THREAD_ID } from '../../../../api/types';
import { MediaViewerOrigin } from '../../../../types';

import { getMessageReplyInfo } from '../../../../global/helpers/replies';

import useLastCallback from '../../../../hooks/useLastCallback';

export default function useInnerHandlers({
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
  isTranslatingChat,
  story,
  isReplyPrivate,
  isRepliesChat,
  isSavedMessages,
}: {
  lang: OldLangFn;
  selectMessage: (e: React.MouseEvent<HTMLDivElement, MouseEvent>, groupedId?: string) => void;
  message: ApiMessage;
  chatId: string;
  threadId: ThreadId;
  isInDocumentGroup: boolean;
  asForwarded?: boolean;
  isScheduled?: boolean;
  album?: IAlbum;
  avatarPeer?: ApiPeer;
  senderPeer?: ApiPeer;
  botSender?: ApiUser;
  messageTopic?: ApiTopic;
  isTranslatingChat?: boolean;
  story?: ApiStory;
  isReplyPrivate?: boolean;
  isRepliesChat?: boolean;
  isSavedMessages?: boolean;
}) {
  const {
    openChat, showNotification, focusMessage, openMediaViewer, openAudioPlayer,
    markMessagesRead, cancelUploadMedia, sendPollVote, openForwardMenu,
    openChatLanguageModal, openThread, openStoryViewer, searchChatMediaMessages,
  } = getActions();

  const {
    id: messageId, forwardInfo, groupedId, content: { paidMedia },
  } = message;

  const {
    replyToMsgId, replyToPeerId, replyToTopId, isQuote, quoteText,
  } = getMessageReplyInfo(message) || {};

  const handleAvatarClick = useLastCallback(() => {
    if (!avatarPeer) {
      return;
    }

    openChat({ id: avatarPeer.id });
  });

  const handleSenderClick = useLastCallback(() => {
    if (!senderPeer) {
      showNotification({ message: lang('HidAccount') });

      return;
    }

    if (asForwarded && forwardInfo?.channelPostId) {
      focusMessage({ chatId: senderPeer.id, messageId: forwardInfo.channelPostId });
    } else {
      openChat({ id: senderPeer.id });
    }
  });

  const handleViaBotClick = useLastCallback(() => {
    if (!botSender) {
      return;
    }

    openChat({ id: botSender.id });
  });

  const handleReplyClick = useLastCallback((): void => {
    if (!replyToMsgId || isReplyPrivate) {
      showNotification({
        message: isQuote ? lang('QuotePrivate') : lang('ReplyPrivate'),
      });
      return;
    }

    focusMessage({
      chatId: replyToPeerId || chatId,
      threadId: isRepliesChat ? replyToTopId : threadId, // Open comments from Replies bot, otherwise, keep current thread
      messageId: replyToMsgId,
      replyMessageId: replyToPeerId ? undefined : messageId,
      noForumTopicPanel: !replyToPeerId, // Open topic panel for cross-chat replies
      ...(isQuote && { quote: quoteText?.text }),
    });
  });

  const handleMediaClick = useLastCallback((): void => {
    openMediaViewer({
      chatId,
      threadId,
      messageId,
      origin: isScheduled ? MediaViewerOrigin.ScheduledInline : MediaViewerOrigin.Inline,
    });
  });
  const openMediaViewerWithPhotoOrVideo = useLastCallback((withDynamicLoading: boolean): void => {
    if (paidMedia && !paidMedia.isBought) return;
    if (withDynamicLoading) {
      searchChatMediaMessages({ chatId, threadId, currentMediaMessageId: messageId });
    }
    openMediaViewer({
      chatId,
      threadId,
      messageId,
      origin: isScheduled ? MediaViewerOrigin.ScheduledInline : MediaViewerOrigin.Inline,
      withDynamicLoading,
    });
  });
  const handlePhotoMediaClick = useLastCallback((): void => {
    const withDynamicLoading = !isScheduled && !paidMedia;
    openMediaViewerWithPhotoOrVideo(withDynamicLoading);
  });
  const handleVideoMediaClick = useLastCallback(() => {
    const isGif = message.content?.video?.isGif;
    const withDynamicLoading = !isGif && !isScheduled && !paidMedia;
    openMediaViewerWithPhotoOrVideo(withDynamicLoading);
  });

  const handleAudioPlay = useLastCallback((): void => {
    openAudioPlayer({ chatId, messageId });
  });

  const handleAlbumMediaClick = useLastCallback((albumMessageId: number, albumIndex?: number): void => {
    if (paidMedia && !paidMedia.isBought) return;

    searchChatMediaMessages({ chatId, threadId, currentMediaMessageId: messageId });
    openMediaViewer({
      chatId,
      threadId,
      messageId: albumMessageId,
      mediaIndex: albumIndex,
      origin: isScheduled ? MediaViewerOrigin.ScheduledAlbum : MediaViewerOrigin.Album,
      withDynamicLoading: !paidMedia,
    });
  });

  const handleReadMedia = useLastCallback((): void => {
    markMessagesRead({ messageIds: [messageId] });
  });

  const handleCancelUpload = useLastCallback(() => {
    cancelUploadMedia({ chatId, messageId });
  });

  const handleVoteSend = useLastCallback((options: string[]) => {
    sendPollVote({ chatId, messageId, options });
  });

  const handleGroupForward = useLastCallback(() => {
    openForwardMenu({ fromChatId: chatId, groupedId });
  });

  const handleForward = useLastCallback(() => {
    if (album && album.messages) {
      const messageIds = album.messages.map(({ id }) => id);
      openForwardMenu({ fromChatId: chatId, messageIds });
    } else {
      openForwardMenu({ fromChatId: chatId, messageIds: [messageId] });
    }
  });

  const handleFocus = useLastCallback(() => {
    focusMessage({
      chatId, threadId: MAIN_THREAD_ID, messageId,
    });
  });

  const handleFocusForwarded = useLastCallback(() => {
    const originalChatId = (isSavedMessages && forwardInfo!.savedFromPeerId) || forwardInfo!.fromChatId!;

    if (isInDocumentGroup) {
      focusMessage({
        chatId: originalChatId, groupedId, groupedChatId: chatId, messageId: forwardInfo!.fromMessageId!,
      });
      return;
    }

    if (replyToPeerId && replyToTopId) {
      focusMessage({
        chatId: replyToPeerId,
        threadId: replyToTopId,
        messageId: forwardInfo!.fromMessageId!,
      });
    } else {
      focusMessage({
        chatId: originalChatId, messageId: forwardInfo!.fromMessageId!,
      });
    }
  });

  const selectWithGroupedId = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    selectMessage(e, groupedId);
  });

  const handleTranslationClick = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    openChatLanguageModal({ chatId, messageId: !isTranslatingChat ? messageId : undefined });
  });

  const handleOpenThread = useLastCallback(() => {
    openThread({
      chatId: message.chatId,
      threadId: message.id,
    });
  });

  const handleTopicChipClick = useLastCallback(() => {
    if (!messageTopic) return;
    focusMessage({
      chatId: replyToPeerId || chatId,
      threadId: messageTopic.id,
      messageId,
    });
  });

  const handleStoryClick = useLastCallback(() => {
    if (!story) return;
    openStoryViewer({
      peerId: story.peerId,
      storyId: story.id,
      isSingleStory: true,
    });
  });

  return {
    handleAvatarClick,
    handleSenderClick,
    handleViaBotClick,
    handleReplyClick,
    handleMediaClick,
    handleAudioPlay,
    handleAlbumMediaClick,
    handlePhotoMediaClick,
    handleVideoMediaClick,
    handleMetaClick: selectWithGroupedId,
    handleTranslationClick,
    handleOpenThread,
    handleReadMedia,
    handleCancelUpload,
    handleVoteSend,
    handleGroupForward,
    handleForward,
    handleFocus,
    handleFocusForwarded,
    handleDocumentGroupSelectAll: selectWithGroupedId,
    handleTopicChipClick,
    handleStoryClick,
  };
}
