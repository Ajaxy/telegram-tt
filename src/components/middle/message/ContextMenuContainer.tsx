import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { MessageListType, TabState } from '../../../global/types';
import type {
  ApiAvailableReaction, ApiStickerSetInfo, ApiMessage, ApiStickerSet, ApiChatReactions, ApiReaction, ApiThreadInfo,
} from '../../../api/types';
import type { IAlbum, IAnchorPosition } from '../../../types';

import {
  selectActiveDownloads,
  selectAllowedMessageActions,
  selectCanPlayAnimatedEmojis,
  selectCanScheduleUntilOnline,
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectIsCurrentUserPremium,
  selectIsMessageProtected,
  selectIsPremiumPurchaseBlocked,
  selectIsReactionPickerOpen,
  selectCanTranslateMessage,
  selectMessageCustomEmojiSets,
  selectMessageTranslations,
  selectRequestedMessageTranslationLanguage,
  selectStickerSet,
  selectRequestedChatTranslationLanguage,
} from '../../../global/selectors';
import {
  isActionMessage,
  isChatChannel,
  isChatGroup,
  isOwnMessage,
  areReactionsEmpty,
  isUserId,
  isMessageLocal,
  getMessageVideo,
  getChatMessageLink,
} from '../../../global/helpers';
import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';

import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useSchedule from '../../../hooks/useSchedule';

import DeleteMessageModal from '../../common/DeleteMessageModal';
import ReportModal from '../../common/ReportModal';
import PinMessageModal from '../../common/PinMessageModal';
import MessageContextMenu from './MessageContextMenu';
import ConfirmDialog from '../../ui/ConfirmDialog';

export type OwnProps = {
  isOpen: boolean;
  chatUsername?: string;
  message: ApiMessage;
  album?: IAlbum;
  anchor: IAnchorPosition;
  targetHref?: string;
  messageListType: MessageListType;
  noReplies?: boolean;
  detectedLanguage?: string;
  repliesThreadInfo?: ApiThreadInfo;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd: NoneToVoidFunction;
};

type StateProps = {
  availableReactions?: ApiAvailableReaction[];
  topReactions?: ApiReaction[];
  customEmojiSetsInfo?: ApiStickerSetInfo[];
  customEmojiSets?: ApiStickerSet[];
  noOptions?: boolean;
  canSendNow?: boolean;
  canReschedule?: boolean;
  canReply?: boolean;
  canPin?: boolean;
  canShowReactionsCount?: boolean;
  canBuyPremium?: boolean;
  canShowReactionList?: boolean;
  canUnpin?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  canEdit?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  canTranslate?: boolean;
  canShowOriginal?: boolean;
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
  activeDownloads?: TabState['activeDownloads']['byChatId'][number];
  canShowSeenBy?: boolean;
  enabledReactions?: ApiChatReactions;
  canScheduleUntilOnline?: boolean;
  maxUniqueReactions?: number;
  threadId?: number;
  canPlayAnimatedEmojis?: boolean;
  isReactionPickerOpen?: boolean;
};

const ContextMenuContainer: FC<OwnProps & StateProps> = ({
  availableReactions,
  topReactions,
  isOpen,
  messageListType,
  chatUsername,
  message,
  customEmojiSetsInfo,
  customEmojiSets,
  album,
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
  canReport,
  canShowReactionsCount,
  canShowReactionList,
  canEdit,
  enabledReactions,
  maxUniqueReactions,
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
  activeDownloads,
  noReplies,
  canShowSeenBy,
  canScheduleUntilOnline,
  canTranslate,
  canShowOriginal,
  canSelectLanguage,
  threadId,
  onClose,
  onCloseAnimationEnd,
  isReactionPickerOpen,
}) => {
  const {
    openChat,
    setReplyingToId,
    setEditingId,
    pinMessage,
    openForwardMenu,
    faveSticker,
    unfaveSticker,
    toggleMessageSelection,
    sendScheduledMessages,
    rescheduleMessage,
    downloadMessageMedia,
    cancelMessageMediaDownload,
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
    openReactionPicker,
  } = getActions();

  const lang = useLang();
  const { transitionClassNames } = useShowTransition(isOpen, onCloseAnimationEnd, undefined, false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isClosePollDialogOpen, openClosePollDialog, closeClosePollDialog] = useFlag();

  const [requestCalendar, calendar] = useSchedule(canScheduleUntilOnline, onClose, message.date);

  // `undefined` indicates that emoji are present and loading
  const hasCustomEmoji = customEmojiSetsInfo === undefined || Boolean(customEmojiSetsInfo.length);

  useEffect(() => {
    if (canShowSeenBy && isOpen) {
      loadSeenBy({ chatId: message.chatId, messageId: message.id });
    }
  }, [loadSeenBy, isOpen, message.chatId, message.id, canShowSeenBy]);

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

  const seenByRecentUsers = useMemo(() => {
    if (message.reactions?.recentReactions?.length) {
      // No need for expensive global updates on users, so we avoid them
      const usersById = getGlobal().users.byId;

      const uniqueReactors = new Set(message.reactions?.recentReactions?.map(({ userId }) => usersById[userId]));

      return Array.from(uniqueReactors).filter(Boolean).slice(0, 3);
    }

    if (!message.seenByDates) {
      return undefined;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    return Object.keys(message.seenByDates).slice(0, 3).map((id) => usersById[id]).filter(Boolean);
  }, [message.reactions?.recentReactions, message.seenByDates]);

  const isDownloading = useMemo(() => {
    if (album) {
      return album.messages.some((msg) => {
        return activeDownloads?.[message.isScheduled ? 'scheduledIds' : 'ids']?.includes(msg.id);
      });
    }

    return activeDownloads?.[message.isScheduled ? 'scheduledIds' : 'ids']?.includes(message.id);
  }, [activeDownloads, album, message]);

  const handleDelete = useLastCallback(() => {
    setIsMenuOpen(false);
    setIsDeleteModalOpen(true);
  });

  const handleReport = useLastCallback(() => {
    setIsMenuOpen(false);
    setIsReportModalOpen(true);
  });

  const closeMenu = useLastCallback(() => {
    setIsMenuOpen(false);
    onClose();
  });

  const closeDeleteModal = useLastCallback(() => {
    setIsDeleteModalOpen(false);
    onClose();
  });

  const closeReportModal = useLastCallback(() => {
    setIsReportModalOpen(false);
    onClose();
  });

  const closePinModal = useLastCallback(() => {
    setIsPinModalOpen(false);
    onClose();
  });

  const handleReply = useLastCallback(() => {
    setReplyingToId({ messageId: message.id });
    closeMenu();
  });

  const handleOpenThread = useLastCallback(() => {
    openChat({
      id: message.chatId,
      threadId: message.id,
    });
    closeMenu();
  });

  const handleEdit = useLastCallback(() => {
    setEditingId({ messageId: message.id });
    closeMenu();
  });

  const handlePin = useLastCallback(() => {
    setIsMenuOpen(false);
    setIsPinModalOpen(true);
  });

  const handleUnpin = useLastCallback(() => {
    pinMessage({ messageId: message.id, isUnpin: true });
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
    copyTextToClipboard(getChatMessageLink(message.chatId, chatUsername, threadId, message.id));
    closeMenu();
  });

  const handleCopyNumber = useLastCallback(() => {
    copyTextToClipboard(message.content.contact!.phoneNumber);
    closeMenu();
  });

  const handleDownloadClick = useLastCallback(() => {
    (album?.messages || [message]).forEach((msg) => {
      if (isDownloading) {
        cancelMessageMediaDownload({ message: msg });
      } else {
        downloadMessageMedia({ message: msg });
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
    toggleReaction({
      chatId: message.chatId, messageId: message.id, reaction, shouldAddToRecent: true,
    });
    closeMenu();
  });

  const handleReactionPickerOpen = useLastCallback((position: IAnchorPosition) => {
    openReactionPicker({ chatId: message.chatId, messageId: message.id, position });
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

  if (noOptions) {
    closeMenu();

    return undefined;
  }

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  return (
    <div className={buildClassName('ContextMenuContainer', transitionClassNames)}>
      <MessageContextMenu
        isReactionPickerOpen={isReactionPickerOpen}
        availableReactions={availableReactions}
        topReactions={topReactions}
        message={message}
        isPrivate={isPrivate}
        isCurrentUserPremium={isCurrentUserPremium}
        canBuyPremium={canBuyPremium}
        isOpen={isMenuOpen}
        enabledReactions={enabledReactions}
        maxUniqueReactions={maxUniqueReactions}
        anchor={anchor}
        targetHref={targetHref}
        canShowReactionsCount={canShowReactionsCount}
        canShowReactionList={canShowReactionList}
        canSendNow={canSendNow}
        canReschedule={canReschedule}
        canReply={canReply}
        canDelete={canDelete}
        canReport={canReport}
        canPin={canPin}
        repliesThreadInfo={repliesThreadInfo}
        canUnpin={canUnpin}
        canEdit={canEdit}
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
        hasCustomEmoji={hasCustomEmoji}
        customEmojiSets={customEmojiSets}
        isDownloading={isDownloading}
        seenByRecentUsers={seenByRecentUsers}
        noReplies={noReplies}
        onOpenThread={handleOpenThread}
        onReply={handleReply}
        onEdit={handleEdit}
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
        onShowReactors={handleOpenReactorListModal}
        onReactionPickerOpen={handleReactionPickerOpen}
        onTranslate={handleTranslate}
        onShowOriginal={handleShowOriginal}
        onSelectLanguage={handleSelectLanguage}
      />
      <DeleteMessageModal
        isOpen={isDeleteModalOpen}
        isSchedule={messageListType === 'scheduled'}
        onClose={closeDeleteModal}
        album={album}
        message={message}
      />
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={closeReportModal}
        messageIds={reportMessageIds}
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
        text={lang('lng_polls_stop_warning')}
        confirmLabel={lang('lng_polls_stop_sure')}
        confirmHandler={handlePollClose}
      />
      {canReschedule && calendar}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, messageListType, detectedLanguage }): StateProps => {
    const { threadId } = selectCurrentMessageList(global) || {};
    const activeDownloads = selectActiveDownloads(global, message.chatId);
    const chat = selectChat(global, message.chatId);
    const { seenByExpiresAt, seenByMaxChatMembers, maxUniqueReactions } = global.appConfig || {};
    const {
      noOptions,
      canReply,
      canPin,
      canUnpin,
      canDelete,
      canReport,
      canEdit,
      canForward,
      canFaveSticker,
      canUnfaveSticker,
      canCopy,
      canCopyLink,
      canSelect,
      canDownload,
      canSaveGif,
      canRevote,
      canClosePoll,
    } = (threadId && selectAllowedMessageActions(global, message, threadId)) || {};

    const isPrivate = chat && isUserId(chat.id);
    const isOwn = isOwnMessage(message);
    const isPinned = messageListType === 'pinned';
    const isScheduled = messageListType === 'scheduled';
    const isChannel = chat && isChatChannel(chat);
    const isLocal = isMessageLocal(message);
    const canShowSeenBy = Boolean(!isLocal
      && chat
      && seenByMaxChatMembers
      && seenByExpiresAt
      && isChatGroup(chat)
      && isOwn
      && !isScheduled
      && chat.membersCount
      && chat.membersCount <= seenByMaxChatMembers
      && message.date > Date.now() / 1000 - seenByExpiresAt);
    const isAction = isActionMessage(message);
    const chatFullInfo = !isPrivate ? selectChatFullInfo(global, message.chatId) : undefined;
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

    return {
      availableReactions: global.availableReactions,
      topReactions: global.topReactions,
      noOptions,
      canSendNow: isScheduled,
      canReschedule: isScheduled,
      canReply: !isPinned && !isScheduled && canReply,
      canPin: !isScheduled && canPin,
      canUnpin: !isScheduled && canUnpin,
      canDelete,
      canReport,
      canEdit: !isPinned && canEdit,
      canForward: !isScheduled && canForward,
      canFaveSticker: !isScheduled && canFaveSticker,
      canUnfaveSticker: !isScheduled && canUnfaveSticker,
      canCopy: canCopyNumber || (!isProtected && canCopy),
      canCopyLink: !isScheduled && canCopyLink,
      canSelect,
      canDownload: !isProtected && canDownload,
      canSaveGif: !isProtected && canSaveGif,
      canRevote,
      canClosePoll: !isScheduled && canClosePoll,
      activeDownloads,
      canShowSeenBy,
      enabledReactions: chat?.isForbidden ? undefined : chatFullInfo?.enabledReactions,
      maxUniqueReactions,
      isPrivate,
      isCurrentUserPremium,
      hasFullInfo: Boolean(chatFullInfo),
      canShowReactionsCount,
      canShowReactionList: !isLocal && !isAction && !isScheduled && chat?.id !== SERVICE_NOTIFICATIONS_USER_ID,
      canBuyPremium: !isCurrentUserPremium && !selectIsPremiumPurchaseBlocked(global),
      customEmojiSetsInfo,
      customEmojiSets,
      canScheduleUntilOnline: selectCanScheduleUntilOnline(global, message.chatId),
      threadId,
      canTranslate,
      canShowOriginal: hasTranslation && !isChatTranslated,
      canSelectLanguage: hasTranslation && !isChatTranslated,
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
      isReactionPickerOpen: selectIsReactionPickerOpen(global),
    };
  },
)(ContextMenuContainer));
