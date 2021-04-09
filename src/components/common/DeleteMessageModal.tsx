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
  getUserFirstName,
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
  contactFirstName?: string;
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
  contactFirstName,
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
        <p>This will delete it just for you, not for other participants in the chat.</p>
      )}
      {willDeleteForAll && (
        <p>This will delete it for everyone in this chat.</p>
      )}
      {canDeleteForAll && (
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForAll}>
          Delete for {contactFirstName ? 'me and ' : 'Everyone'}
          {contactFirstName && renderText(contactFirstName)}
        </Button>
      )}
      <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForSelf}>
        Delete{canDeleteForAll ? ' just for me' : ''}
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
    const contactFirstName = chat && isChatPrivate(chat.id)
      ? getUserFirstName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;

    const willDeleteForCurrentUserOnly = chat && isChatBasicGroup(chat) && !canDeleteForAll;
    const willDeleteForAll = chat && isChatSuperGroup(chat);

    return {
      canDeleteForAll: !isSchedule && canDeleteForAll,
      contactFirstName,
      willDeleteForCurrentUserOnly,
      willDeleteForAll,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'deleteMessages', 'deleteScheduledMessages',
  ]),
)(DeleteMessageModal));
