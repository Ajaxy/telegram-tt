/* eslint-disable react/self-closing-comp */
/* eslint-disable max-len */
import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiMessage } from '../../api/types';
import type { IAlbum } from '../../types';

import {
  getPrivateChatUserId,
  getUserFirstOrLastName,
  isChatBasicGroup,
  isChatSuperGroup,
  isUserId,
} from '../../global/helpers';
import {
  selectAllowedMessageActions,
  selectBot,
  selectChat,
  selectCurrentMessageList,
  selectUser,
} from '../../global/selectors';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import RadioGroup from '../ui/RadioGroup';

export type OwnProps = {
  isOpen: boolean;
  isSchedule: boolean;
  message: ApiMessage;
  album?: IAlbum;
  onClose: NoneToVoidFunction;
  onConfirm?: NoneToVoidFunction;
};

type StateProps = {
  canDeleteForAll?: boolean;
  contactName?: string;
  willDeleteForCurrentUserOnly?: boolean;
  willDeleteForAll?: boolean;
};

const DeleteMessageModal: FC<OwnProps & StateProps> = ({
  isOpen,
  isSchedule,
  message,
  album,
  canDeleteForAll,
  contactName,
  onConfirm,
  onClose,
}) => {
  const {
    deleteMessages,
    deleteScheduledMessages,
  } = getActions();

  const [shouldDeleteForAll, setShouldDeleteForAll] = useState(canDeleteForAll ? 'everyone' : 'me');
  const lang = useLang();
  const deleteOptions = [
    {
      label: lang('ChatList.DeleteForCurrentUser'),
      value: 'me',
    },
    {
      label: contactName ? renderText(lang('Conversation.DeleteMessagesFor', contactName)) : lang('Conversation.DeleteMessagesForEveryone'),
      value: 'everyone',
    },
  ];

  const handleDelete = useCallback(() => {
    onConfirm?.();
    const messageIds = album?.messages ? album.messages.map(({ id }) => id) : [message.id];
    if (isSchedule) {
      deleteScheduledMessages({ messageIds });
    } else {
      deleteMessages({ messageIds, shouldDeleteForAll: shouldDeleteForAll === 'everyone' });
    }
    onClose();
  }, [onConfirm, album, message.id, isSchedule, deleteMessages, deleteScheduledMessages, onClose, shouldDeleteForAll]);

  const handleRadioChange = useCallback((value: string) => {
    setShouldDeleteForAll(value);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={handleDelete}
      className="delete"
      title={lang('DeleteSingleMessagesTitle')}
    >
      <p>{lang('AreYouSureDeleteSingleMessage')}</p>
      {canDeleteForAll && (
        <RadioGroup
          name="deleteFor"
          options={deleteOptions}
          selected={shouldDeleteForAll ? 'everyone' : 'me'}
          // eslint-disable-next-line react/jsx-no-bind
          onChange={(value) => handleRadioChange(value)}
        />
      )}
      <div className="dialog-buttons">
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDelete}>
          {lang('Delete')}
          <div className="hotkey-frame">
            <div className="enter-hotkey-icon"></div>
          </div>
        </Button>
        <Button className="confirm-dialog-button" color="secondary" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, isSchedule }): StateProps => {
    const { threadId } = selectCurrentMessageList(global) || {};
    const { canDeleteForAll } = (threadId && selectAllowedMessageActions(global, message, threadId)) || {};
    const chat = selectChat(global, message.chatId);
    const contactName = chat && isUserId(chat.id)
      ? getUserFirstOrLastName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;
    const isChatWithBot = Boolean(selectBot(global, message.chatId));

    const willDeleteForCurrentUserOnly = (chat && isChatBasicGroup(chat) && !canDeleteForAll) || isChatWithBot;
    const willDeleteForAll = chat && isChatSuperGroup(chat);

    return {
      canDeleteForAll: !isSchedule && canDeleteForAll,
      contactName,
      willDeleteForCurrentUserOnly,
      willDeleteForAll,
    };
  },
)(DeleteMessageModal));
