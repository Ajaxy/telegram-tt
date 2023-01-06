import type React from '../../../../lib/teact/teact';
import { useCallback } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { IAlbum } from '../../../../types';
import { MediaViewerOrigin } from '../../../../types';
import type {
  ApiChat, ApiTopic, ApiMessage, ApiUser,
} from '../../../../api/types';
import { MAIN_THREAD_ID } from '../../../../api/types';
import type { LangFn } from '../../../../hooks/useLang';

export default function useInnerHandlers(
  lang: LangFn,
  selectMessage: (e: React.MouseEvent<HTMLDivElement, MouseEvent>, groupedId?: string) => void,
  message: ApiMessage,
  chatId: string,
  threadId: number,
  isInDocumentGroup: boolean,
  asForwarded?: boolean,
  isScheduled?: boolean,
  isChatWithRepliesBot?: boolean,
  album?: IAlbum,
  avatarPeer?: ApiUser | ApiChat,
  senderPeer?: ApiUser | ApiChat,
  botSender?: ApiUser,
  messageTopic?: ApiTopic,
) {
  const {
    openChat, showNotification, focusMessage, openMediaViewer, openAudioPlayer,
    markMessagesRead, cancelSendingMessage, sendPollVote, openForwardMenu, focusMessageInComments,
  } = getActions();

  const {
    id: messageId, forwardInfo, replyToMessageId, replyToChatId, replyToTopMessageId, groupedId,
  } = message;

  const handleAvatarClick = useCallback(() => {
    if (!avatarPeer) {
      return;
    }

    openChat({ id: avatarPeer.id });
  }, [avatarPeer, openChat]);

  const handleSenderClick = useCallback(() => {
    if (!senderPeer) {
      showNotification({ message: lang('HidAccount') });

      return;
    }

    if (asForwarded && forwardInfo?.channelPostId) {
      focusMessage({ chatId: senderPeer.id, messageId: forwardInfo.channelPostId });
    } else {
      openChat({ id: senderPeer.id });
    }
  }, [
    asForwarded, focusMessage, forwardInfo, lang, openChat, senderPeer, showNotification,
  ]);

  const handleViaBotClick = useCallback(() => {
    if (!botSender) {
      return;
    }

    openChat({ id: botSender.id });
  }, [botSender, openChat]);

  const handleReplyClick = useCallback((): void => {
    focusMessage({
      chatId: isChatWithRepliesBot && replyToChatId ? replyToChatId : chatId,
      threadId,
      messageId: replyToMessageId,
      replyMessageId: isChatWithRepliesBot && replyToChatId ? undefined : messageId,
    });
  }, [focusMessage, isChatWithRepliesBot, replyToChatId, chatId, threadId, replyToMessageId, messageId]);

  const handleMediaClick = useCallback((): void => {
    openMediaViewer({
      chatId,
      threadId,
      mediaId: messageId,
      origin: isScheduled ? MediaViewerOrigin.ScheduledInline : MediaViewerOrigin.Inline,
    });
  }, [chatId, threadId, messageId, openMediaViewer, isScheduled]);

  const handleAudioPlay = useCallback((): void => {
    openAudioPlayer({ chatId, messageId });
  }, [chatId, messageId, openAudioPlayer]);

  const handleAlbumMediaClick = useCallback((albumMessageId: number): void => {
    openMediaViewer({
      chatId,
      threadId,
      mediaId: albumMessageId,
      origin: isScheduled ? MediaViewerOrigin.ScheduledAlbum : MediaViewerOrigin.Album,
    });
  }, [chatId, threadId, openMediaViewer, isScheduled]);

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
    openForwardMenu({ fromChatId: chatId, groupedId });
  }, [openForwardMenu, chatId, groupedId]);

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
        chatId: forwardInfo!.fromChatId, groupedId, groupedChatId: chatId,
      });
      return;
    }

    if (isChatWithRepliesBot && replyToChatId) {
      focusMessageInComments({
        chatId: replyToChatId,
        threadId: replyToTopMessageId,
        messageId: forwardInfo!.fromMessageId,
      });
    } else {
      focusMessage({
        chatId: forwardInfo!.fromChatId, messageId: forwardInfo!.fromMessageId,
      });
    }
  }, [
    isInDocumentGroup, isChatWithRepliesBot, replyToChatId, focusMessage, forwardInfo, groupedId, chatId,
    focusMessageInComments, replyToTopMessageId,
  ]);

  const selectWithGroupedId = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();

    selectMessage(e, groupedId);
  }, [selectMessage, groupedId]);

  const handleTopicChipClick = useCallback(() => {
    if (!messageTopic) return;
    focusMessage({
      chatId: isChatWithRepliesBot && replyToChatId ? replyToChatId : chatId,
      threadId: messageTopic.id,
      messageId,
    });
  }, [chatId, focusMessage, isChatWithRepliesBot, messageTopic, messageId, replyToChatId]);

  return {
    handleAvatarClick,
    handleSenderClick,
    handleViaBotClick,
    handleReplyClick,
    handleMediaClick,
    handleAudioPlay,
    handleAlbumMediaClick,
    handleMetaClick: selectWithGroupedId,
    handleReadMedia,
    handleCancelUpload,
    handleVoteSend,
    handleGroupForward,
    handleForward,
    handleFocus,
    handleFocusForwarded,
    handleDocumentGroupSelectAll: selectWithGroupedId,
    handleTopicChipClick,
  };
}
