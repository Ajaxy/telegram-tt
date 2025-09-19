import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiAvailableReaction,
  ApiChat,
  ApiChatReactions,
  ApiMessage,
  ApiPoll,
  ApiReaction,
  ApiStickerSet,
  ApiStickerSetInfo,
  ApiThreadInfo,
  ApiTypeStory,
  ApiWebPage,
} from '../../../api/types';
import type {
  ActiveDownloads,
  IAlbum,
  IAnchorPosition,
  MessageListType,
  ThreadId,
} from '../../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { PREVIEW_AVATAR_COUNT, SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import {
  areReactionsEmpty,
  getCanPostInChat,
  getIsDownloading,
  getMessageVideo,
  getUserFullName,
  hasMessageTtl,
  isActionMessage,
  isChatChannel,
  isChatGroup,
  isMessageLocal,
  isOwnMessage,
  isUserRightBanned,
} from '../../../global/helpers';
import {
  selectActiveDownloads,
  selectAllowedMessageActionsSlow,
  selectBot,
  selectCanForwardMessage,
  selectCanGift,
  selectCanPlayAnimatedEmojis,
  selectCanScheduleUntilOnline,
  selectCanTranslateMessage,
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectIsMessageProtected,
  selectIsMessageUnread,
  selectIsPremiumPurchaseBlocked,
  selectIsReactionPickerOpen,
  selectMessageCustomEmojiSets,
  selectMessageTranslations,
  selectPeerStory,
  selectPollFromMessage,
  selectRequestedChatTranslationLanguage,
  selectRequestedMessageTranslationLanguage,
  selectSavedDialogIdFromMessage,
  selectStickerSet,
  selectThreadInfo,
  selectTopic,
  selectUser,
  selectUserStatus,
  selectWebPageFromMessage,
} from '../../../global/selectors';
import { selectMessageDownloadableMedia } from '../../../global/selectors/media';
import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { isUserId } from '../../../util/entities/ids';
import { getSelectionAsFormattedText } from './helpers/getSelectionAsFormattedText';
import { isSelectionRangeInsideMessage } from './helpers/isSelectionRangeInsideMessage';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useSchedule from '../../../hooks/useSchedule';
import useShowTransition from '../../../hooks/useShowTransition';

import PinMessageModal from '../../common/PinMessageModal.async';
import ConfirmDialog from '../../ui/ConfirmDialog';
import MessageContextMenu from './MessageContextMenu';

export type OwnProps = {
  isOpen: boolean;
  message: ApiMessage;
  album?: IAlbum;
  anchor: IAnchorPosition;
  targetHref?: string;
  messageListType: MessageListType;
  noReplies?: boolean;
  detectedLanguage?: string;
  repliesThreadInfo?: ApiThreadInfo;
  className?: string;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd: NoneToVoidFunction;
};

type StateProps = {
  threadId?: ThreadId;
  poll?: ApiPoll;
  webPage?: ApiWebPage;
  story?: ApiTypeStory;
  chat?: ApiChat;
  availableReactions?: ApiAvailableReaction[];
  topReactions?: ApiReaction[];
  defaultTagReactions?: ApiReaction[];
  noOptions?: boolean;
  canSendNow?: boolean;
  canReschedule?: boolean;
  canReply?: boolean;
  canPin?: boolean;
  canShowReactionsCount?: boolean;
  canBuyPremium?: boolean;
  canShowReactionList?: boolean;
  customEmojiSetsInfo?: ApiStickerSetInfo[];
  customEmojiSets?: ApiStickerSet[];
  canUnpin?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  canEdit?: boolean;
  canAppendTodoList?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  canTranslate?: boolean;
  canShowOriginal?: boolean;
  isMessageTranslated?: boolean;
  canSelectLanguage?: boolean;
  isPrivate?: boolean;
  isCurrentUserPremium?: boolean;
  hasFullInfo?: boolean;
  canCopyLink?: boolean;
  canSelect?: boolean;
  canDownload?: boolean;
  canSaveGif?: boolean;
  canRevote?: boolean;
  canClosePoll?: boolean;
  canLoadReadDate?: boolean;
  shouldRenderShowWhen?: boolean;
  activeDownloads: ActiveDownloads;
  canShowSeenBy?: boolean;
  enabledReactions?: ApiChatReactions;
  canScheduleUntilOnline?: boolean;
  reactionsLimit?: number;
  canPlayAnimatedEmojis?: boolean;
  isReactionPickerOpen?: boolean;
  isInSavedMessages?: boolean;
  isChannel?: boolean;
  canReplyInChat?: boolean;
  isWithPaidReaction?: boolean;
  userFullName?: string;
  canGift?: boolean;
  savedDialogId?: string;
};

const selection = window.getSelection();
const UNQUOTABLE_OFFSET = -1;

const ContextMenuContainer: FC<OwnProps & StateProps> = ({
  threadId,
  availableReactions,
  topReactions,
  defaultTagReactions,
  isOpen,
  messageListType,
  message,
  customEmojiSetsInfo,
  customEmojiSets,
  album,
  poll,
  webPage,
  story,
  anchor,
  targetHref,
  noOptions,
  canSendNow,
  hasFullInfo,
  canReschedule,
  canReply,
  canPin,
  repliesThreadInfo,
  canUnpin,
  canDelete,
  canShowReactionsCount,
  chat,
  canReport,
  canShowReactionList,
  canEdit,
  canAppendTodoList,
  enabledReactions,
  reactionsLimit,
  isPrivate,
  isCurrentUserPremium,
  canForward,
  canBuyPremium,
  canFaveSticker,
  canUnfaveSticker,
  canCopy,
  canCopyLink,
  canSelect,
  canDownload,
  canSaveGif,
  canRevote,
  canClosePoll,
  canPlayAnimatedEmojis,
  canLoadReadDate,
  shouldRenderShowWhen,
  activeDownloads,
  noReplies,
  canShowSeenBy,
  canScheduleUntilOnline,
  canTranslate,
  isMessageTranslated,
  canShowOriginal,
  canSelectLanguage,
  isReactionPickerOpen,
  isInSavedMessages,
  canReplyInChat,
  isWithPaidReaction,
  userFullName,
  canGift,
  className,
  savedDialogId,
  onClose,
  onCloseAnimationEnd,
}) => {
  const {
    openThread,
    updateDraftReplyInfo,
    setEditingId,
    pinMessage,
    openForwardMenu,
    openReplyMenu,
    faveSticker,
    unfaveSticker,
    toggleMessageSelection,
    sendScheduledMessages,
    rescheduleMessage,
    downloadMedia,
    cancelMediaDownload,
    loadSeenBy,
    openSeenByModal,
    openReactorListModal,
    loadFullChat,
    loadReactors,
    copyMessagesByIds,
    saveGif,
    loadStickers,
    cancelPollVote,
    closePoll,
    toggleReaction,
    requestMessageTranslation,
    showOriginalMessage,
    openChatLanguageModal,
    openMessageReactionPicker,
    openPremiumModal,
    loadOutboxReadDate,
    copyMessageLink,
    openDeleteMessageModal,
    addLocalPaidReaction,
    openPaidReactionModal,
    reportMessages,
    openTodoListModal,
    showNotification,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();
  const { ref: containerRef } = useShowTransition({
    isOpen,
    onCloseAnimationEnd,
    className: false,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isClosePollDialogOpen, openClosePollDialog, closeClosePollDialog] = useFlag();
  const [selectionQuoteOffset, setSelectionQuoteOffset] = useState(UNQUOTABLE_OFFSET);
  const [requestCalendar, calendar] = useSchedule(canScheduleUntilOnline, onClose, message.date);

  // `undefined` indicates that emoji are present and loading
  const hasCustomEmoji = customEmojiSetsInfo === undefined || Boolean(customEmojiSetsInfo.length);

  useEffect(() => {
    if (canShowSeenBy && isOpen) {
      loadSeenBy({ chatId: message.chatId, messageId: message.id });
    }
  }, [loadSeenBy, isOpen, message.chatId, message.id, canShowSeenBy]);

  useEffect(() => {
    if (canLoadReadDate && isOpen) {
      loadOutboxReadDate({ chatId: message.chatId, messageId: message.id });
    }
  }, [canLoadReadDate, isOpen, message.chatId, message.id, message.readDate]);

  useEffect(() => {
    if (canShowReactionsCount && isOpen) {
      loadReactors({ chatId: message.chatId, messageId: message.id });
    }
  }, [canShowReactionsCount, isOpen, loadReactors, message.chatId, message.id]);

  useEffect(() => {
    if (customEmojiSetsInfo?.length && customEmojiSets?.length !== customEmojiSetsInfo.length) {
      customEmojiSetsInfo.forEach((set) => {
        loadStickers({ stickerSetInfo: set });
      });
    }
  }, [customEmojiSetsInfo, customEmojiSets, loadStickers]);

  useEffect(() => {
    if (!hasFullInfo && !isPrivate && isOpen) {
      loadFullChat({ chatId: message.chatId });
    }
  }, [hasFullInfo, isOpen, isPrivate, loadFullChat, message.chatId]);

  const seenByRecentPeers = useMemo(() => {
    // No need for expensive global updates on chats or users, so we avoid them
    const chatsById = getGlobal().chats.byId;
    const usersById = getGlobal().users.byId;
    if (message.reactions?.recentReactions?.length) {
      const uniqueReactors = new Set(message.reactions?.recentReactions?.map(
        ({ peerId }) => usersById[peerId] || chatsById[peerId],
      ));

      return Array.from(uniqueReactors).filter(Boolean).slice(0, PREVIEW_AVATAR_COUNT);
    }

    if (!message.seenByDates) {
      return undefined;
    }

    return Object.keys(message.seenByDates).slice(0, PREVIEW_AVATAR_COUNT)
      .map((id) => usersById[id] || chatsById[id])
      .filter(Boolean);
  }, [message.reactions?.recentReactions, message.seenByDates]);

  const isDownloading = useMemo(() => {
    const global = getGlobal();
    if (album) {
      return album.messages.some((msg) => {
        const downloadableMedia = selectMessageDownloadableMedia(global, msg);
        if (!downloadableMedia) return false;
        return getIsDownloading(activeDownloads, downloadableMedia);
      });
    }

    const downloadableMedia = selectMessageDownloadableMedia(global, message);
    if (!downloadableMedia) return false;
    return getIsDownloading(activeDownloads, downloadableMedia);
  }, [activeDownloads, album, message]);

  const selectionRange = canReply && selection?.rangeCount ? selection.getRangeAt(0) : undefined;

  useEffect(() => {
    if (isMessageTranslated) {
      setSelectionQuoteOffset(UNQUOTABLE_OFFSET);
      return;
    }

    const isMessageTextSelected = selectionRange
      && !selectionRange.collapsed
      && Boolean(message.content.text?.text)
      && isSelectionRangeInsideMessage(selectionRange);

    if (!isMessageTextSelected) {
      setSelectionQuoteOffset(UNQUOTABLE_OFFSET);
      return;
    }

    const selectionText = getSelectionAsFormattedText(selectionRange);

    const messageText = message.content.text!.text.replace(/\u00A0/g, ' ');

    const canQuote = selectionText.text.trim().length > 0
      && messageText.includes(selectionText.text);
    if (!canQuote) {
      setSelectionQuoteOffset(UNQUOTABLE_OFFSET);
      return;
    }

    setSelectionQuoteOffset(selectionRange.startOffset);
  }, [
    selectionRange, selectionRange?.collapsed, selectionRange?.startOffset, selectionRange?.endOffset,
    isMessageTranslated, message.content.text,
  ]);

  const closeMenu = useLastCallback(() => {
    setIsMenuOpen(false);
    onClose();
  });

  const handleDelete = useLastCallback(() => {
    setIsMenuOpen(false);
    closeMenu();
    const messageIds = album?.messages
      ? album.messages.map(({ id }) => id)
      : [message.id];
    openDeleteMessageModal({
      chatId: message.chatId,
      messageIds,
      isSchedule: messageListType === 'scheduled',
    });
  });

  const closePinModal = useLastCallback(() => {
    setIsPinModalOpen(false);
    onClose();
  });

  const handleReply = useLastCallback(() => {
    const quoteText = selectionQuoteOffset !== UNQUOTABLE_OFFSET && selectionRange
      ? getSelectionAsFormattedText(selectionRange) : undefined;
    if (!canReplyInChat) {
      openReplyMenu({
        fromChatId: message.chatId, messageId: message.id, quoteText, quoteOffset: selectionQuoteOffset,
      });
    } else {
      updateDraftReplyInfo({
        replyToMsgId: message.id,
        quoteText,
        quoteOffset: selectionQuoteOffset,
        monoforumPeerId: savedDialogId,
        replyToPeerId: undefined,
      });
    }
    closeMenu();
  });

  const handleOpenThread = useLastCallback(() => {
    openThread({
      chatId: message.chatId,
      threadId: message.id,
    });
    closeMenu();
  });

  const handleEdit = useLastCallback(() => {
    if (message.content.todo) {
      openTodoListModal({
        chatId: message.chatId,
        messageId: message.id,
      });
    } else {
      setEditingId({ messageId: message.id });
    }
    closeMenu();
  });

  const handleAppendTodoList = useLastCallback(() => {
    if (!isCurrentUserPremium) {
      showNotification({
        message: lang('SubscribeToTelegramPremiumForAppendToDo'),
        action: {
          action: 'openPremiumModal',
          payload: { initialSection: 'todo' },
        },
        actionText: oldLang('PremiumMore'),
      });
    } else {
      openTodoListModal({
        chatId: message.chatId,
        messageId: message.id,
        forNewTask: true,
      });
    }
    closeMenu();
  });

  const handlePin = useLastCallback(() => {
    setIsMenuOpen(false);
    setIsPinModalOpen(true);
  });

  const handleUnpin = useLastCallback(() => {
    pinMessage({ chatId: message.chatId, messageId: message.id, isUnpin: true });
    closeMenu();
  });

  const handleForward = useLastCallback(() => {
    closeMenu();
    if (album?.messages) {
      const messageIds = album.messages.map(({ id }) => id);
      openForwardMenu({ fromChatId: message.chatId, messageIds });
    } else {
      openForwardMenu({ fromChatId: message.chatId, messageIds: [message.id] });
    }
  });

  const handleFaveSticker = useLastCallback(() => {
    closeMenu();
    faveSticker({ sticker: message.content.sticker! });
  });

  const handleUnfaveSticker = useLastCallback(() => {
    closeMenu();
    unfaveSticker({ sticker: message.content.sticker! });
  });

  const handleCancelVote = useLastCallback(() => {
    closeMenu();
    cancelPollVote({ chatId: message.chatId, messageId: message.id });
  });

  const handlePollClose = useLastCallback(() => {
    closeMenu();
    closePoll({ chatId: message.chatId, messageId: message.id });
  });

  const handleSelectMessage = useLastCallback(() => {
    const params = album?.messages
      ? {
        messageId: message.id,
        childMessageIds: album.messages.map(({ id }) => id),
        withShift: false,
      }
      : { messageId: message.id, withShift: false };

    toggleMessageSelection(params);
    closeMenu();
  });

  const handleScheduledMessageSend = useLastCallback(() => {
    sendScheduledMessages({ chatId: message.chatId, id: message.id });
    closeMenu();
  });

  const handleRescheduleMessage = useLastCallback((scheduledAt: number) => {
    rescheduleMessage({
      chatId: message.chatId,
      messageId: message.id,
      scheduledAt,
    });
    onClose();
  });

  const handleOpenCalendar = useLastCallback(() => {
    setIsMenuOpen(false);
    requestCalendar(handleRescheduleMessage);
  });

  const handleOpenSeenByModal = useLastCallback(() => {
    closeMenu();
    openSeenByModal({ chatId: message.chatId, messageId: message.id });
  });

  const handleOpenReactorListModal = useLastCallback(() => {
    closeMenu();
    openReactorListModal({ chatId: message.chatId, messageId: message.id });
  });

  const handleCopyMessages = useLastCallback((messageIds: number[]) => {
    copyMessagesByIds({ messageIds });
    closeMenu();
  });

  const handleCopyLink = useLastCallback(() => {
    copyMessageLink({
      chatId: message.chatId,
      messageId: message.id,
      shouldIncludeThread: threadId !== MAIN_THREAD_ID,
      shouldIncludeGrouped: true, // TODO: Provide correct value when ability to target specific message is added
    });
    closeMenu();
  });

  const handleCopyNumber = useLastCallback(() => {
    copyTextToClipboard(message.content.contact!.phoneNumber);
    closeMenu();
  });

  const handleDownloadClick = useLastCallback(() => {
    const global = getGlobal();
    (album?.messages || [message]).forEach((msg) => {
      const downloadableMedia = selectMessageDownloadableMedia(global, msg);
      if (!downloadableMedia) return;

      if (isDownloading) {
        cancelMediaDownload({ media: downloadableMedia });
      } else {
        downloadMedia({ media: downloadableMedia, originMessage: msg });
      }
    });
    closeMenu();
  });

  const handleSaveGif = useLastCallback(() => {
    const video = getMessageVideo(message);
    saveGif({ gif: video! });
    closeMenu();
  });

  const handleToggleReaction = useLastCallback((reaction: ApiReaction) => {
    if (isInSavedMessages && !isCurrentUserPremium) {
      openPremiumModal({
        initialSection: 'saved_tags',
      });
    } else {
      toggleReaction({
        chatId: message.chatId, messageId: message.id, reaction, shouldAddToRecent: true,
      });
    }
    closeMenu();
  });

  const handleSendPaidReaction = useLastCallback(() => {
    addLocalPaidReaction({
      chatId: message.chatId, messageId: message.id, count: 1,
    });
    closeMenu();
  });

  const handlePaidReactionModalOpen = useLastCallback(() => {
    openPaidReactionModal({
      chatId: message.chatId,
      messageId: message.id,
    });

    closeMenu();
  });

  const handleReactionPickerOpen = useLastCallback((position: IAnchorPosition) => {
    openMessageReactionPicker({ chatId: message.chatId, messageId: message.id, position });
  });

  const handleTranslate = useLastCallback(() => {
    requestMessageTranslation({
      chatId: message.chatId,
      id: message.id,
    });
    closeMenu();
  });

  const handleShowOriginal = useLastCallback(() => {
    showOriginalMessage({
      chatId: message.chatId,
      id: message.id,
    });
    closeMenu();
  });

  const handleSelectLanguage = useLastCallback(() => {
    openChatLanguageModal({
      chatId: message.chatId,
      messageId: message.id,
    });
    closeMenu();
  });

  const reportMessageIds = useMemo(() => (album ? album.messages : [message]).map(({ id }) => id), [album, message]);

  const handleReport = useLastCallback(() => {
    if (!chat) return;
    setIsMenuOpen(false);
    onClose();
    reportMessages({
      chatId: chat.id, messageIds: reportMessageIds,
    });
  });

  if (noOptions) {
    closeMenu();

    return undefined;
  }

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  return (
    <div ref={containerRef} className={buildClassName('ContextMenuContainer', className)}>
      <MessageContextMenu
        isReactionPickerOpen={isReactionPickerOpen}
        availableReactions={availableReactions}
        topReactions={topReactions}
        defaultTagReactions={defaultTagReactions}
        isWithPaidReaction={isWithPaidReaction}
        message={message}
        isPrivate={isPrivate}
        isCurrentUserPremium={isCurrentUserPremium}
        canBuyPremium={canBuyPremium}
        isOpen={isMenuOpen}
        enabledReactions={enabledReactions}
        reactionsLimit={reactionsLimit}
        anchor={anchor}
        targetHref={targetHref}
        canShowReactionsCount={canShowReactionsCount}
        canShowReactionList={canShowReactionList}
        canSendNow={canSendNow}
        canReschedule={canReschedule}
        canReply={canReply}
        canQuote={selectionQuoteOffset !== UNQUOTABLE_OFFSET}
        canDelete={canDelete}
        canPin={canPin}
        canReport={canReport}
        repliesThreadInfo={repliesThreadInfo}
        canUnpin={canUnpin}
        canEdit={canEdit}
        canAppendTodoList={canAppendTodoList}
        canForward={canForward}
        canFaveSticker={canFaveSticker}
        canUnfaveSticker={canUnfaveSticker}
        canCopy={canCopy}
        canCopyLink={canCopyLink}
        canSelect={canSelect}
        canDownload={canDownload}
        canSaveGif={canSaveGif}
        canRevote={canRevote}
        canClosePoll={canClosePoll}
        canShowSeenBy={canShowSeenBy}
        canTranslate={canTranslate}
        canShowOriginal={canShowOriginal}
        canSelectLanguage={canSelectLanguage}
        canPlayAnimatedEmojis={canPlayAnimatedEmojis}
        shouldRenderShowWhen={shouldRenderShowWhen}
        canLoadReadDate={canLoadReadDate}
        hasCustomEmoji={hasCustomEmoji}
        customEmojiSets={customEmojiSets}
        isDownloading={isDownloading}
        seenByRecentPeers={seenByRecentPeers}
        isInSavedMessages={isInSavedMessages}
        noReplies={noReplies}
        poll={poll}
        webPage={webPage}
        story={story}
        onOpenThread={handleOpenThread}
        onReply={handleReply}
        onEdit={handleEdit}
        onAppendTodoList={handleAppendTodoList}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onForward={handleForward}
        onDelete={handleDelete}
        onReport={handleReport}
        onFaveSticker={handleFaveSticker}
        onUnfaveSticker={handleUnfaveSticker}
        onSelect={handleSelectMessage}
        onSend={handleScheduledMessageSend}
        onReschedule={handleOpenCalendar}
        onClose={closeMenu}
        onCopyLink={handleCopyLink}
        onCopyMessages={handleCopyMessages}
        onCopyNumber={handleCopyNumber}
        onDownload={handleDownloadClick}
        onSaveGif={handleSaveGif}
        onCancelVote={handleCancelVote}
        onClosePoll={openClosePollDialog}
        onShowSeenBy={handleOpenSeenByModal}
        onToggleReaction={handleToggleReaction}
        onSendPaidReaction={handleSendPaidReaction}
        onShowPaidReactionModal={handlePaidReactionModalOpen}
        onShowReactors={handleOpenReactorListModal}
        onReactionPickerOpen={handleReactionPickerOpen}
        onTranslate={handleTranslate}
        onShowOriginal={handleShowOriginal}
        onSelectLanguage={handleSelectLanguage}
        userFullName={userFullName}
        canGift={canGift}
      />
      <PinMessageModal
        isOpen={isPinModalOpen}
        messageId={message.id}
        chatId={message.chatId}
        onClose={closePinModal}
      />
      <ConfirmDialog
        isOpen={isClosePollDialogOpen}
        onClose={closeClosePollDialog}
        text={oldLang('lng_polls_stop_warning')}
        confirmLabel={oldLang('lng_polls_stop_sure')}
        confirmHandler={handlePollClose}
      />
      {canReschedule && calendar}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, messageListType, detectedLanguage }): Complete<StateProps> => {
    const { threadId } = selectCurrentMessageList(global) || {};

    const { defaultTags, topReactions, availableReactions } = global.reactions;

    const activeDownloads = selectActiveDownloads(global);
    const chat = selectChat(global, message.chatId);
    const isPrivate = chat && isUserId(chat.id);
    const chatFullInfo = !isPrivate ? selectChatFullInfo(global, message.chatId) : undefined;
    const user = selectUser(global, message.chatId);
    const userFullName = user && getUserFullName(user);

    const {
      seenByExpiresAt, seenByMaxChatMembers, maxUniqueReactions, readDateExpiresAt,
    } = global.appConfig;

    const reactionsLimit = chatFullInfo?.reactionsLimit || maxUniqueReactions;

    const {
      noOptions,
      canReplyGlobally,
      canPin,
      canUnpin,
      canDelete,
      canReport,
      canEdit,
      canFaveSticker,
      canUnfaveSticker,
      canCopy,
      canCopyLink,
      canSelect,
      canDownload,
      canSaveGif,
      canRevote,
      canClosePoll,
    } = (threadId && selectAllowedMessageActionsSlow(global, message, threadId)) || {};
    const canForward = selectCanForwardMessage(global, message);

    const userStatus = isPrivate ? selectUserStatus(global, chat.id) : undefined;
    const isOwn = isOwnMessage(message);
    const chatBot = chat && selectBot(global, chat.id);
    const isBot = Boolean(chatBot);
    const isMessageUnread = selectIsMessageUnread(global, message);
    const canLoadReadDate = Boolean(
      isPrivate
      && isOwn
      && !isBot
      && !isMessageUnread
      && readDateExpiresAt
      && message.date > Date.now() / 1000 - readDateExpiresAt
      && !userStatus?.isReadDateRestricted
      && messageListType !== 'scheduled',
    );
    const shouldRenderShowWhen = Boolean(
      canLoadReadDate && isPrivate && selectUserStatus(global, chat.id)?.isReadDateRestrictedByMe,
    );
    const isPinned = messageListType === 'pinned';
    const isScheduled = messageListType === 'scheduled';
    const isChannel = chat && isChatChannel(chat);

    const threadInfo = threadId && selectThreadInfo(global, message.chatId, threadId);
    const isMessageThread = Boolean(threadInfo && !threadInfo?.isCommentsInfo && threadInfo?.fromChannelId);
    const topic = threadId ? selectTopic(global, message.chatId, threadId) : undefined;

    const canSendText = chat && !isUserRightBanned(chat, 'sendPlain', chatFullInfo);

    const canReplyInChat = chat && threadId ? getCanPostInChat(chat, topic, isMessageThread, chatFullInfo)
      && canSendText : false;

    const isLocal = isMessageLocal(message);
    const hasTtl = hasMessageTtl(message);
    const canShowSeenBy = Boolean(!isLocal
      && chat
      && !chat.isMonoforum
      && !isMessageUnread
      && seenByMaxChatMembers
      && seenByExpiresAt
      && isChatGroup(chat)
      && isOwn
      && !isScheduled
      && chat.membersCount
      && chat.membersCount <= seenByMaxChatMembers
      && message.date > Date.now() / 1000 - seenByExpiresAt);
    const isAction = isActionMessage(message);
    const canShowReactionsCount = !isLocal && !isChannel && !isScheduled && !isAction && !isPrivate && message.reactions
      && !areReactionsEmpty(message.reactions) && message.reactions.canSeeList;
    const isProtected = selectIsMessageProtected(global, message);
    const canCopyNumber = Boolean(message.content.contact);
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    const customEmojiSetsInfo = selectMessageCustomEmojiSets(global, message);
    const customEmojiSetsNotFiltered = customEmojiSetsInfo?.map((set) => selectStickerSet(global, set));
    const customEmojiSets = customEmojiSetsNotFiltered?.every<ApiStickerSet>(Boolean)
      ? customEmojiSetsNotFiltered : undefined;

    const translationRequestLanguage = selectRequestedMessageTranslationLanguage(global, message.chatId, message.id);
    const hasTranslation = translationRequestLanguage
      ? Boolean(selectMessageTranslations(global, message.chatId, translationRequestLanguage)[message.id]?.text)
      : undefined;
    const canTranslate = !hasTranslation && selectCanTranslateMessage(global, message, detectedLanguage);
    const isChatTranslated = selectRequestedChatTranslationLanguage(global, message.chatId);

    const isInSavedMessages = selectIsChatWithSelf(global, message.chatId);

    const poll = selectPollFromMessage(global, message);
    const webPage = selectWebPageFromMessage(global, message);
    const storyData = message.content.storyData;
    const story = storyData ? selectPeerStory(global, storyData.peerId, storyData.id) : undefined;

    const canGift = selectCanGift(global, message.chatId);

    const savedDialogId = selectSavedDialogIdFromMessage(global, message);
    const todoItemsMax = global.appConfig.todoItemsMax;
    const canAppendTodoList = message.content.todo?.todo.othersCanAppend
      && message.content.todo?.todo.items?.length < todoItemsMax;

    return {
      threadId,
      chat,
      availableReactions,
      topReactions,
      defaultTagReactions: defaultTags,
      noOptions,
      canReport,
      canSendNow: isScheduled,
      canReschedule: isScheduled,
      canReply: !isPinned && !isScheduled && canReplyGlobally,
      canPin: !isScheduled && canPin,
      canUnpin: !isScheduled && canUnpin,
      canDelete,
      canEdit: !isPinned && canEdit,
      canAppendTodoList,
      canForward: !isScheduled && canForward,
      canFaveSticker: !isScheduled && canFaveSticker,
      canUnfaveSticker: !isScheduled && canUnfaveSticker,
      canCopy: (canCopyNumber || (!isProtected && canCopy)),
      canCopyLink: !isScheduled && canCopyLink,
      canSelect,
      canDownload: !isProtected && canDownload,
      canSaveGif: !isProtected && canSaveGif,
      canRevote,
      canClosePoll: !isScheduled && canClosePoll,
      activeDownloads,
      canShowSeenBy,
      canLoadReadDate,
      shouldRenderShowWhen,
      enabledReactions: chat?.isForbidden ? undefined : chatFullInfo?.enabledReactions,
      reactionsLimit,
      isPrivate,
      isCurrentUserPremium,
      hasFullInfo: Boolean(chatFullInfo),
      canShowReactionsCount,
      canShowReactionList: !isLocal && !isAction
        && !isScheduled && chat?.id !== SERVICE_NOTIFICATIONS_USER_ID && !hasTtl,
      canBuyPremium: !isCurrentUserPremium && !selectIsPremiumPurchaseBlocked(global),
      customEmojiSetsInfo,
      customEmojiSets,
      canScheduleUntilOnline: selectCanScheduleUntilOnline(global, message.chatId),
      canTranslate,
      canShowOriginal: hasTranslation && !isChatTranslated,
      canSelectLanguage: hasTranslation && !isChatTranslated,
      isMessageTranslated: hasTranslation,
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
      isReactionPickerOpen: selectIsReactionPickerOpen(global),
      isInSavedMessages,
      isChannel,
      canReplyInChat,
      isWithPaidReaction: chatFullInfo?.isPaidReactionAvailable,
      poll,
      story,
      userFullName,
      canGift,
      savedDialogId,
      webPage,
    };
  },
)(ContextMenuContainer));
