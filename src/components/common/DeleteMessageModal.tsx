import React, { FC, useCallback, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiMessage } from '../../api/types';
import { IAlbum } from '../../types';

import { GlobalActions } from '../../global/types';

import {
  selectAllowedMessageActions,
  selectChat,
  selectCurrentMessageList,
  selectUser,
} from '../../modules/selectors';
import {
  isChatPrivate,
  getUserFirstOrLastName,
  getPrivateChatUserId,
  isChatBasicGroup,
  isChatSuperGroup,
} from '../../modules/helpers';
import renderText from './helpers/renderText';
import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type OwnProps = {
  isOpen: boolean;
  isSchedule: boolean;
  message: ApiMessage;
  album?: IAlbum;
  onClose: () => void;
};

type StateProps = {
  canDeleteForAll?: boolean;
  contactName?: string;
  willDeleteForCurrentUserOnly?: boolean;
  willDeleteForAll?: boolean;
};

type DispatchProps = Pick<GlobalActions, 'deleteMessages' | 'deleteScheduledMessages'>;

const DeleteMessageModal: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen,
  isSchedule,
  message,
  album,
  canDeleteForAll,
  contactName,
  willDeleteForCurrentUserOnly,
  willDeleteForAll,
  onClose,
  deleteMessages,
  deleteScheduledMessages,
}) => {
  const handleDeleteMessageForAll = useCallback(() => {
    const messageIds = album && album.messages
      ? album.messages.map(({ id }) => id)
      : [message.id];
    deleteMessages({ messageIds, shouldDeleteForAll: true });
    onClose();
  }, [deleteMessages, message.id, onClose, album]);

  const handleDeleteMessageForSelf = useCallback(() => {
    const messageIds = album && album.messages
      ? album.messages.map(({ id }) => id)
      : [message.id];
    if (isSchedule) {
      deleteScheduledMessages({ messageIds });
    } else {
      deleteMessages({
        messageIds,
        shouldDeleteForAll: false,
      });
    }
    onClose();
  }, [album, message.id, isSchedule, onClose, deleteScheduledMessages, deleteMessages]);

  const lang = useLang();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={isOpen && !canDeleteForAll ? handleDeleteMessageForSelf : undefined}
      className="delete"
      title={lang('DeleteSingleMessagesTitle')}
    >
      <p>{lang('AreYouSureDeleteSingleMessage')}</p>
      {willDeleteForCurrentUserOnly && (
        <p>{lang('lng_delete_for_me_chat_hint')}</p>
      )}
      {willDeleteForAll && (
        <p>{lang('lng_delete_for_everyone_hint', 1, 'i')}</p>
      )}
      {canDeleteForAll && (
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForAll}>
          {contactName && lang('Conversation.DeleteMessagesFor', renderText(contactName))}
          {!contactName && lang('Conversation.DeleteMessagesForEveryone')}
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
  (global, { message, isSchedule }): StateProps => {
    const { threadId } = selectCurrentMessageList(global) || {};
    const { canDeleteForAll } = (threadId && selectAllowedMessageActions(global, message, threadId)) || {};
    const chat = selectChat(global, message.chatId);
    const contactName = chat && isChatPrivate(chat.id)
      ? getUserFirstOrLastName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;

    const willDeleteForCurrentUserOnly = chat && isChatBasicGroup(chat) && !canDeleteForAll;
    const willDeleteForAll = chat && isChatSuperGroup(chat);

    return {
      canDeleteForAll: !isSchedule && canDeleteForAll,
      contactName,
      willDeleteForCurrentUserOnly,
      willDeleteForAll,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'deleteMessages', 'deleteScheduledMessages',
  ]),
)(DeleteMessageModal));
