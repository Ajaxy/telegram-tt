import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions, MessageListType } from '../../../global/types';
import { ApiMessage } from '../../../api/types';
import { IAlbum, IAnchorPosition } from '../../../types';
import { selectAllowedMessageActions, selectCurrentMessageList } from '../../../modules/selectors';
import { disableScrolling, enableScrolling } from '../../../util/scrollLock';
import { pick } from '../../../util/iteratees';
import useShowTransition from '../../../hooks/useShowTransition';
import useFlag from '../../../hooks/useFlag';

import DeleteMessageModal from '../../common/DeleteMessageModal';
import PinMessageModal from '../../common/PinMessageModal';
import MessageContextMenu from './MessageContextMenu';
import CalendarModal from '../../common/CalendarModal';
import { getDayStartAt } from '../../../util/dateFormat';

export type OwnProps = {
  isOpen: boolean;
  message: ApiMessage;
  album?: IAlbum;
  anchor: IAnchorPosition;
  messageListType: MessageListType;
  onClose: () => void;
  onCloseAnimationEnd: () => void;
};

type StateProps = {
  noOptions?: boolean;
  canSendNow?: boolean;
  canReschedule?: boolean;
  canReply?: boolean;
  canPin?: boolean;
  canUnpin?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  canCopyLink?: boolean;
  canSelect?: boolean;
};

type DispatchProps = Pick<GlobalActions, (
  'setReplyingToId' | 'setEditingId' | 'pinMessage' | 'openForwardMenu' |
  'faveSticker' | 'unfaveSticker' | 'toggleMessageSelection' | 'sendScheduledMessages' | 'rescheduleMessage' |
  'loadMessageLink'
)>;

const ContextMenuContainer: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen,
  messageListType,
  message,
  album,
  anchor,
  onClose,
  onCloseAnimationEnd,
  noOptions,
  canSendNow,
  canReschedule,
  canReply,
  canPin,
  canUnpin,
  canDelete,
  canEdit,
  canForward,
  canFaveSticker,
  canUnfaveSticker,
  canCopy,
  canCopyLink,
  canSelect,
  setReplyingToId,
  setEditingId,
  pinMessage,
  openForwardMenu,
  faveSticker,
  unfaveSticker,
  toggleMessageSelection,
  sendScheduledMessages,
  rescheduleMessage,
  loadMessageLink,
}) => {
  const { transitionClassNames } = useShowTransition(isOpen, onCloseAnimationEnd, undefined, false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isCalendarOpen, openCalendar, closeCalendar] = useFlag();

  const handleDelete = useCallback(() => {
    setIsMenuOpen(false);
    setIsDeleteModalOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    onClose();
  }, [onClose]);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
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
    if (album && album.messages) {
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
    const params = album && album.messages
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

  const handleRescheduleMessage = useCallback((date: Date) => {
    rescheduleMessage({
      chatId: message.chatId,
      messageId: message.id,
      scheduledAt: Math.round(date.getTime() / 1000),
    });
  }, [message.chatId, message.id, rescheduleMessage]);

  const handleCopyLink = useCallback(() => {
    loadMessageLink({
      messageId: message.id,
      chatId: message.chatId,
    });
    closeMenu();
  }, [closeMenu, loadMessageLink, message.chatId, message.id]);

  useEffect(() => {
    disableScrolling();

    return enableScrolling;
  }, []);

  if (noOptions) {
    closeMenu();

    return undefined;
  }

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  return (
    <div className={['ContextMenuContainer', transitionClassNames].join(' ')}>
      <MessageContextMenu
        message={message}
        isOpen={isMenuOpen}
        anchor={anchor}
        canSendNow={canSendNow}
        canReschedule={canReschedule}
        canReply={canReply}
        canDelete={canDelete}
        canPin={canPin}
        canUnpin={canUnpin}
        canEdit={canEdit}
        canForward={canForward}
        canFaveSticker={canFaveSticker}
        canUnfaveSticker={canUnfaveSticker}
        canCopy={canCopy}
        canCopyLink={canCopyLink}
        canSelect={canSelect}
        onReply={handleReply}
        onEdit={handleEdit}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onForward={handleForward}
        onDelete={handleDelete}
        onFaveSticker={handleFaveSticker}
        onUnfaveSticker={handleUnfaveSticker}
        onSelect={handleSelectMessage}
        onSend={handleScheduledMessageSend}
        onReschedule={handleOpenCalendar}
        onClose={closeMenu}
        onCopyLink={handleCopyLink}
      />
      <DeleteMessageModal
        isOpen={isDeleteModalOpen}
        isSchedule={messageListType === 'scheduled'}
        onClose={closeDeleteModal}
        album={album}
        message={message}
      />
      <PinMessageModal
        isOpen={isPinModalOpen}
        messageId={message.id}
        chatId={message.chatId}
        onClose={closePinModal}
      />
      <CalendarModal
        isOpen={isCalendarOpen}
        withTimePicker
        selectedAt={message.date * 1000}
        maxAt={getDayStartAt(scheduledMaxDate)}
        isFutureMode
        onClose={handleCloseCalendar}
        onSubmit={handleRescheduleMessage}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, messageListType }): StateProps => {
    const { threadId } = selectCurrentMessageList(global) || {};
    const {
      noOptions,
      canReply,
      canPin,
      canUnpin,
      canDelete,
      canEdit,
      canForward,
      canFaveSticker,
      canUnfaveSticker,
      canCopy,
      canCopyLink,
      canSelect,
    } = (threadId && selectAllowedMessageActions(global, message, threadId)) || {};
    const isPinned = messageListType === 'pinned';
    const isScheduled = messageListType === 'scheduled';

    return {
      noOptions,
      canSendNow: isScheduled,
      canReschedule: isScheduled,
      canReply: !isPinned && !isScheduled && canReply,
      canPin: !isScheduled && canPin,
      canUnpin: !isScheduled && canUnpin,
      canDelete,
      canEdit: !isPinned && canEdit,
      canForward: !isScheduled && canForward,
      canFaveSticker: !isScheduled && canFaveSticker,
      canUnfaveSticker: !isScheduled && canUnfaveSticker,
      canCopy,
      canCopyLink: !isScheduled && canCopyLink,
      canSelect,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'setReplyingToId',
    'setEditingId',
    'pinMessage',
    'openForwardMenu',
    'faveSticker',
    'unfaveSticker',
    'toggleMessageSelection',
    'sendScheduledMessages',
    'rescheduleMessage',
    'loadMessageLink',
  ]),
)(ContextMenuContainer));
