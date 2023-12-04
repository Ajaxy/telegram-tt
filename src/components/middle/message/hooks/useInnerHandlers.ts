import type React from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiMessage, ApiPeer, ApiStory, ApiTopic, ApiUser,
} from '../../../../api/types';
import type { LangFn } from '../../../../hooks/useLang';
import type { IAlbum } from '../../../../types';
import { MAIN_THREAD_ID } from '../../../../api/types';
import { MediaViewerOrigin } from '../../../../types';

import { getMessageReplyInfo } from '../../../../global/helpers/replies';

import useLastCallback from '../../../../hooks/useLastCallback';

export default function useInnerHandlers(
  lang: LangFn,
  selectMessage: (e: React.MouseEvent<HTMLDivElement, MouseEvent>, groupedId?: string) => void,
  message: ApiMessage,
  chatId: string,
  threadId: number,
  isInDocumentGroup: boolean,
  asForwarded?: boolean,
  isScheduled?: boolean,
  album?: IAlbum,
  avatarPeer?: ApiPeer,
  senderPeer?: ApiPeer,
  botSender?: ApiUser,
  messageTopic?: ApiTopic,
  isTranslatingChat?: boolean,
  story?: ApiStory,
  isReplyPrivate?: boolean,
  isRepliesChat?: boolean,
) {
  const {
    openChat, showNotification, focusMessage, openMediaViewer, openAudioPlayer,
    markMessagesRead, cancelSendingMessage, sendPollVote, openForwardMenu,
    openChatLanguageModal, openThread, openStoryViewer,
  } = getActions();

  const {
    id: messageId, forwardInfo, groupedId,
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
      mediaId: messageId,
      origin: isScheduled ? MediaViewerOrigin.ScheduledInline : MediaViewerOrigin.Inline,
    });
  });

  const handleAudioPlay = useLastCallback((): void => {
    openAudioPlayer({ chatId, messageId });
  });

  const handleAlbumMediaClick = useLastCallback((albumMessageId: number): void => {
    openMediaViewer({
      chatId,
      threadId,
      mediaId: albumMessageId,
      origin: isScheduled ? MediaViewerOrigin.ScheduledAlbum : MediaViewerOrigin.Album,
    });
  });

  const handleReadMedia = useLastCallback((): void => {
    markMessagesRead({ messageIds: [messageId] });
  });

  const handleCancelUpload = useLastCallback(() => {
    cancelSendingMessage({ chatId, messageId });
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
    if (isInDocumentGroup) {
      focusMessage({
        chatId: forwardInfo!.fromChatId!, groupedId, groupedChatId: chatId, messageId: forwardInfo!.fromMessageId!,
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
        chatId: forwardInfo!.fromChatId!, messageId: forwardInfo!.fromMessageId!,
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
