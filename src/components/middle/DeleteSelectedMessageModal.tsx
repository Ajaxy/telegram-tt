import React, { FC, useCallback, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';

import { selectCanDeleteSelectedMessages, selectCurrentChat, selectUser } from '../../modules/selectors';
import {
  isChatPrivate,
  getUserFirstOrLastName,
  getPrivateChatUserId,
  isChatBasicGroup,
  isChatSuperGroup,
} from '../../modules/helpers';
import renderText from '../common/helpers/renderText';
import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

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

type DispatchProps = Pick<GlobalActions, 'deleteMessages' | 'exitMessageSelectMode' | 'deleteScheduledMessages'>;

const DeleteSelectedMessageModal: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen,
  isSchedule,
  selectedMessageIds,
  canDeleteForAll,
  contactName,
  willDeleteForCurrentUserOnly,
  willDeleteForAll,
  onClose,
  deleteMessages,
  deleteScheduledMessages,
  exitMessageSelectMode,
}) => {
  const handleDeleteMessageForAll = useCallback(() => {
    deleteMessages({ messageIds: selectedMessageIds, shouldDeleteForAll: true });
    exitMessageSelectMode();
    onClose();
  }, [deleteMessages, exitMessageSelectMode, selectedMessageIds, onClose]);

  const handleDeleteMessageForSelf = useCallback(() => {
    if (isSchedule) {
      deleteScheduledMessages({ messageIds: selectedMessageIds });
    } else {
      deleteMessages({ messageIds: selectedMessageIds, shouldDeleteForAll: false });
    }

    exitMessageSelectMode();
    onClose();
  }, [
    isSchedule, exitMessageSelectMode, onClose, deleteScheduledMessages, selectedMessageIds, deleteMessages,
  ]);

  const lang = useLang();

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
    const contactName = chat && isChatPrivate(chat.id)
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
  (setGlobal, actions): DispatchProps => pick(actions, [
    'deleteMessages',
    'deleteScheduledMessages',
    'exitMessageSelectMode',
  ]),
)(DeleteSelectedMessageModal));
