import React, {
  FC, memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getDispatch, getGlobal, withGlobal } from '../../../lib/teact/teactn';

import { MessageListType } from '../../../global/types';
import { ApiAvailableReaction, ApiMessage } from '../../../api/types';
import { IAlbum, IAnchorPosition } from '../../../types';
import {
  selectActiveDownloadIds,
  selectAllowedMessageActions,
  selectChat,
  selectCurrentMessageList,
  selectIsMessageProtected,
} from '../../../modules/selectors';
import {
  isActionMessage, isChatChannel,
  isChatGroup, isOwnMessage, areReactionsEmpty, isUserId, isMessageLocal,
} from '../../../modules/helpers';
import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import { getDayStartAt } from '../../../util/dateFormat';
import { copyTextToClipboard } from '../../../util/clipboard';
import useShowTransition from '../../../hooks/useShowTransition';
import useFlag from '../../../hooks/useFlag';
import { REM } from '../../common/helpers/mediaDimensions';

import DeleteMessageModal from '../../common/DeleteMessageModal';
import ReportMessageModal from '../../common/ReportMessageModal';
import PinMessageModal from '../../common/PinMessageModal';
import MessageContextMenu from './MessageContextMenu';
import CalendarModal from '../../common/CalendarModal';
import buildClassName from '../../../util/buildClassName';

const START_SIZE = 2 * REM;

export type OwnProps = {
  isOpen: boolean;
  chatUsername?: string;
  message: ApiMessage;
  album?: IAlbum;
  anchor: IAnchorPosition;
  messageListType: MessageListType;
  onClose: () => void;
  onCloseAnimationEnd: () => void;
};

type StateProps = {
  availableReactions?: ApiAvailableReaction[];
  noOptions?: boolean;
  canSendNow?: boolean;
  canReschedule?: boolean;
  canReply?: boolean;
  canPin?: boolean;
  canShowReactionsCount?: boolean;
  canShowReactionList?: boolean;
  canRemoveReaction?: boolean;
  canUnpin?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  canEdit?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  isPrivate?: boolean;
  hasFullInfo?: boolean;
  canCopyLink?: boolean;
  canSelect?: boolean;
  canDownload?: boolean;
  activeDownloads: number[];
  canShowSeenBy?: boolean;
  enabledReactions?: string[];
};

const ContextMenuContainer: FC<OwnProps & StateProps> = ({
  availableReactions,
  isOpen,
  messageListType,
  chatUsername,
  message,
  album,
  anchor,
  onClose,
  onCloseAnimationEnd,
  noOptions,
  canSendNow,
  hasFullInfo,
  canReschedule,
  canReply,
  canPin,
  canUnpin,
  canDelete,
  canReport,
  canShowReactionsCount,
  canShowReactionList,
  canRemoveReaction,
  canEdit,
  enabledReactions,
  isPrivate,
  canForward,
  canFaveSticker,
  canUnfaveSticker,
  canCopy,
  canCopyLink,
  canSelect,
  canDownload,
  activeDownloads,
  canShowSeenBy,
}) => {
  const {
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
    sendReaction,
    openReactorListModal,
    loadFullChat,
    loadReactors,
    copyMessagesByIds,
  } = getDispatch();

  const { transitionClassNames } = useShowTransition(isOpen, onCloseAnimationEnd, undefined, false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isCalendarOpen, openCalendar, closeCalendar] = useFlag();

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
    if (!hasFullInfo && !isPrivate && isOpen) {
      loadFullChat({ chatId: message.chatId });
    }
  }, [hasFullInfo, isOpen, isPrivate, loadFullChat, message.chatId]);

  const seenByRecentUsers = useMemo(() => {
    if (message.reactions?.recentReactions?.length) {
      // No need for expensive global updates on users, so we avoid them
      const usersById = getGlobal().users.byId;

      return message.reactions?.recentReactions?.slice(0, 3).map(({ userId }) => usersById[userId]).filter(Boolean);
    }

    if (!message.seenByUserIds) {
      return undefined;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    return message.seenByUserIds?.slice(0, 3).map((id) => usersById[id]).filter(Boolean);
  }, [message.reactions?.recentReactions, message.seenByUserIds]);

  const isDownloading = album ? album.messages.some((msg) => activeDownloads.includes(msg.id))
    : activeDownloads.includes(message.id);

  const handleDelete = useCallback(() => {
    setIsMenuOpen(false);
    setIsDeleteModalOpen(true);
  }, []);

  const handleReport = useCallback(() => {
    setIsMenuOpen(false);
    setIsReportModalOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    onClose();
  }, [onClose]);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    onClose();
  }, [onClose]);

  const closeReportModal = useCallback(() => {
    setIsReportModalOpen(false);
    onClose();
  }, [onClose]);

  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
    onClose();
  }, [onClose]);

  const handleCloseCalendar = useCallback(() => {
    closeCalendar();
    onClose();
  }, [closeCalendar, onClose]);

  const handleReply = useCallback(() => {
    setReplyingToId({ messageId: message.id });
    closeMenu();
  }, [setReplyingToId, message.id, closeMenu]);

  const handleEdit = useCallback(() => {
    setEditingId({ messageId: message.id });
    closeMenu();
  }, [setEditingId, message.id, closeMenu]);

  const handlePin = useCallback(() => {
    setIsMenuOpen(false);
    setIsPinModalOpen(true);
  }, []);

  const handleUnpin = useCallback(() => {
    pinMessage({ messageId: message.id, isUnpin: true });
    closeMenu();
  }, [pinMessage, message.id, closeMenu]);

  const handleForward = useCallback(() => {
    closeMenu();
    if (album?.messages) {
      const messageIds = album.messages.map(({ id }) => id);
      openForwardMenu({ fromChatId: message.chatId, messageIds });
    } else {
      openForwardMenu({ fromChatId: message.chatId, messageIds: [message.id] });
    }
  }, [openForwardMenu, message, closeMenu, album]);

  const handleFaveSticker = useCallback(() => {
    closeMenu();
    faveSticker({ sticker: message.content.sticker });
  }, [closeMenu, message.content.sticker, faveSticker]);

  const handleUnfaveSticker = useCallback(() => {
    closeMenu();
    unfaveSticker({ sticker: message.content.sticker });
  }, [closeMenu, message.content.sticker, unfaveSticker]);

  const handleSelectMessage = useCallback(() => {
    const params = album?.messages
      ? {
        messageId: message.id,
        childMessageIds: album.messages.map(({ id }) => id),
        withShift: false,
      }
      : { messageId: message.id, withShift: false };

    toggleMessageSelection(params);
    closeMenu();
  }, [closeMenu, message.id, toggleMessageSelection, album]);

  const handleScheduledMessageSend = useCallback(() => {
    sendScheduledMessages({ chatId: message.chatId, id: message.id });
    closeMenu();
  }, [closeMenu, message.chatId, message.id, sendScheduledMessages]);

  const handleOpenCalendar = useCallback(() => {
    setIsMenuOpen(false);
    openCalendar();
  }, [openCalendar]);

  const handleOpenSeenByModal = useCallback(() => {
    closeMenu();
    openSeenByModal({ chatId: message.chatId, messageId: message.id });
  }, [closeMenu, message.chatId, message.id, openSeenByModal]);

  const handleOpenReactorListModal = useCallback(() => {
    closeMenu();
    openReactorListModal({ chatId: message.chatId, messageId: message.id });
  }, [closeMenu, openReactorListModal, message.chatId, message.id]);

  const handleRescheduleMessage = useCallback((date: Date) => {
    rescheduleMessage({
      chatId: message.chatId,
      messageId: message.id,
      scheduledAt: Math.round(date.getTime() / 1000),
    });
  }, [message.chatId, message.id, rescheduleMessage]);

  const handleCopyMessages = useCallback((messageIds: number[]) => {
    copyMessagesByIds({ messageIds });
    closeMenu();
  }, [closeMenu, copyMessagesByIds]);

  const handleCopyLink = useCallback(() => {
    copyTextToClipboard(`https://t.me/${chatUsername || `c/${message.chatId.replace('-', '')}`}/${message.id}`);
    closeMenu();
  }, [chatUsername, closeMenu, message.chatId, message.id]);

  const handleDownloadClick = useCallback(() => {
    (album?.messages || [message]).forEach((msg) => {
      if (isDownloading) {
        cancelMessageMediaDownload({ message: msg });
      } else {
        downloadMessageMedia({ message: msg });
      }
    });
    closeMenu();
  }, [album, message, closeMenu, isDownloading, cancelMessageMediaDownload, downloadMessageMedia]);

  const handleSendReaction = useCallback((reaction: string | undefined, x: number, y: number) => {
    sendReaction({
      chatId: message.chatId, messageId: message.id, reaction, x, y, startSize: START_SIZE,
    });
    closeMenu();
  }, [closeMenu, message.chatId, message.id, sendReaction]);

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
        availableReactions={availableReactions}
        message={message}
        isPrivate={isPrivate}
        isOpen={isMenuOpen}
        enabledReactions={enabledReactions}
        anchor={anchor}
        canShowReactionsCount={canShowReactionsCount}
        canShowReactionList={canShowReactionList}
        canRemoveReaction={canRemoveReaction}
        canSendNow={canSendNow}
        canReschedule={canReschedule}
        canReply={canReply}
        canDelete={canDelete}
        canReport={canReport}
        canPin={canPin}
        canUnpin={canUnpin}
        canEdit={canEdit}
        canForward={canForward}
        canFaveSticker={canFaveSticker}
        canUnfaveSticker={canUnfaveSticker}
        canCopy={canCopy}
        canCopyLink={canCopyLink}
        canSelect={canSelect}
        canDownload={canDownload}
        canShowSeenBy={canShowSeenBy}
        isDownloading={isDownloading}
        seenByRecentUsers={seenByRecentUsers}
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
        onDownload={handleDownloadClick}
        onShowSeenBy={handleOpenSeenByModal}
        onSendReaction={handleSendReaction}
        onShowReactors={handleOpenReactorListModal}
      />
      <DeleteMessageModal
        isOpen={isDeleteModalOpen}
        isSchedule={messageListType === 'scheduled'}
        onClose={closeDeleteModal}
        album={album}
        message={message}
      />
      <ReportMessageModal
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
      {canReschedule && (
        <CalendarModal
          isOpen={isCalendarOpen}
          withTimePicker
          selectedAt={message.date * 1000}
          maxAt={getDayStartAt(scheduledMaxDate)}
          isFutureMode
          onClose={handleCloseCalendar}
          onSubmit={handleRescheduleMessage}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, messageListType }): StateProps => {
    const { threadId } = selectCurrentMessageList(global) || {};
    const activeDownloads = selectActiveDownloadIds(global, message.chatId);
    const chat = selectChat(global, message.chatId);
    const { seenByExpiresAt, seenByMaxChatMembers } = global.appConfig || {};
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
    } = (threadId && selectAllowedMessageActions(global, message, threadId)) || {};
    const isPinned = messageListType === 'pinned';
    const isScheduled = messageListType === 'scheduled';
    const isChannel = chat && isChatChannel(chat);
    const isLocal = isMessageLocal(message);
    const canShowSeenBy = Boolean(chat
      && seenByMaxChatMembers
      && seenByExpiresAt
      && isChatGroup(chat)
      && isOwnMessage(message)
      && !isScheduled
      && chat.membersCount
      && chat.membersCount < seenByMaxChatMembers
      && message.date > Date.now() / 1000 - seenByExpiresAt);
    const isPrivate = chat && isUserId(chat.id);
    const isAction = isActionMessage(message);
    const canShowReactionsCount = !isLocal && !isChannel && !isScheduled && !isAction && !isPrivate && message.reactions
      && !areReactionsEmpty(message.reactions) && message.reactions.canSeeList;
    const canRemoveReaction = isPrivate && message.reactions?.results?.some((l) => l.isChosen);
    const isProtected = selectIsMessageProtected(global, message);

    return {
      availableReactions: global.availableReactions,
      noOptions,
      canSendNow: isScheduled,
      canReschedule: isScheduled,
      canReply: !isPinned && !isScheduled && canReply,
      canPin: !isScheduled && canPin,
      canUnpin: !isScheduled && canUnpin,
      canDelete,
      canReport,
      canEdit: !isPinned && canEdit,
      canForward: !isProtected && !isScheduled && canForward,
      canFaveSticker: !isScheduled && canFaveSticker,
      canUnfaveSticker: !isScheduled && canUnfaveSticker,
      canCopy: !isProtected && canCopy,
      canCopyLink: !isProtected && !isScheduled && canCopyLink,
      canSelect,
      canDownload: !isProtected && canDownload,
      activeDownloads,
      canShowSeenBy,
      enabledReactions: chat?.fullInfo?.enabledReactions,
      isPrivate,
      hasFullInfo: Boolean(chat?.fullInfo),
      canShowReactionsCount,
      canShowReactionList: !isLocal && !isAction && !isScheduled && chat?.id !== SERVICE_NOTIFICATIONS_USER_ID,
      canRemoveReaction,
    };
  },
)(ContextMenuContainer));
