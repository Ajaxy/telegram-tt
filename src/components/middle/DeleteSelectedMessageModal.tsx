import React, {
  FC, useCallback, memo, useEffect,
} from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../modules';

import { selectCanDeleteSelectedMessages, selectCurrentChat, selectUser } from '../../modules/selectors';
import {
  isUserId,
  getUserFirstOrLastName,
  getPrivateChatUserId,
  isChatBasicGroup,
  isChatSuperGroup,
} from '../../modules/helpers';
import renderText from '../common/helpers/renderText';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type OwnProps = {
  isOpen: boolean;
  isSchedule: boolean;
  onClose: () => void;
};

type StateProps = {
  selectedMessageIds?: number[];
  canDeleteForAll?: boolean;
  contactName?: string;
  willDeleteForCurrentUserOnly?: boolean;
  willDeleteForAll?: boolean;
};

const DeleteSelectedMessageModal: FC<OwnProps & StateProps> = ({
  isOpen,
  isSchedule,
  selectedMessageIds,
  canDeleteForAll,
  contactName,
  willDeleteForCurrentUserOnly,
  willDeleteForAll,
  onClose,
}) => {
  const {
    deleteMessages,
    deleteScheduledMessages,
    exitMessageSelectMode,
  } = getDispatch();

  const prevIsOpen = usePrevious(isOpen);

  const handleDeleteMessageForAll = useCallback(() => {
    onClose();
    deleteMessages({ messageIds: selectedMessageIds, shouldDeleteForAll: true });
  }, [deleteMessages, selectedMessageIds, onClose]);

  const handleDeleteMessageForSelf = useCallback(() => {
    if (isSchedule) {
      deleteScheduledMessages({ messageIds: selectedMessageIds });
    } else {
      deleteMessages({ messageIds: selectedMessageIds, shouldDeleteForAll: false });
    }

    onClose();
  }, [isSchedule, onClose, deleteScheduledMessages, selectedMessageIds, deleteMessages]);

  const lang = useLang();

  // Returning `undefined` from FC instead of `<Modal>` doesn't trigger useHistoryBack
  useEffect(() => {
    if (!isOpen && prevIsOpen) {
      exitMessageSelectMode();
    }
  }, [exitMessageSelectMode, isOpen, prevIsOpen]);

  if (!selectedMessageIds) {
    return undefined;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={canDeleteForAll ? undefined : handleDeleteMessageForSelf}
      className="delete"
      title={lang('Conversation.DeleteManyMessages')}
    >
      <p>{lang('AreYouSureDeleteFewMessages')}</p>
      {willDeleteForCurrentUserOnly && (
        <p>This will delete them just for you, not for other participants in the chat.</p>
      )}
      {willDeleteForAll && (
        <p>This will delete them for everyone in this chat.</p>
      )}
      {canDeleteForAll && (
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForAll}>
          {contactName
            ? renderText(lang('ChatList.DeleteForEveryone', contactName))
            : lang('Conversation.DeleteMessagesForEveryone')}
        </Button>
      )}
      <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForSelf}>
        {lang(canDeleteForAll ? 'ChatList.DeleteForCurrentUser' : 'Delete')}
      </Button>
      <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { isSchedule }): StateProps => {
    const { messageIds: selectedMessageIds } = global.selectedMessages || {};
    const { canDeleteForAll } = selectCanDeleteSelectedMessages(global);
    const chat = selectCurrentChat(global);
    const contactName = chat && isUserId(chat.id)
      ? getUserFirstOrLastName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;

    const willDeleteForCurrentUserOnly = chat && isChatBasicGroup(chat) && !canDeleteForAll;
    const willDeleteForAll = chat && isChatSuperGroup(chat);

    return {
      selectedMessageIds,
      canDeleteForAll: !isSchedule && canDeleteForAll,
      contactName,
      willDeleteForCurrentUserOnly,
      willDeleteForAll,
    };
  },
)(DeleteSelectedMessageModal));
