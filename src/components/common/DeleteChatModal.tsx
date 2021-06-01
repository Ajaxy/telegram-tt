import React, { FC, useCallback, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiChat } from '../../api/types';
import { GlobalActions } from '../../global/types';

import { selectIsChatWithSelf, selectUser } from '../../modules/selectors';
import {
  isChatPrivate,
  getUserFirstOrLastName,
  getPrivateChatUserId,
  isChatBasicGroup,
  isChatSuperGroup,
  isChatChannel,
  getChatTitle,
} from '../../modules/helpers';
import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';
import renderText from './helpers/renderText';

import Avatar from './Avatar';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

import './DeleteChatModal.scss';

export type OwnProps = {
  isOpen: boolean;
  chat: ApiChat;
  onClose: () => void;
};

type StateProps = {
  isChannel: boolean;
  isChatWithSelf?: boolean;
  isPrivateChat: boolean;
  isBasicGroup: boolean;
  isSuperGroup: boolean;
  canDeleteForAll?: boolean;
  contactName?: string;
};

type DispatchProps = Pick<GlobalActions, 'leaveChannel' | 'deleteHistory' | 'deleteChannel'>;

const DeleteChatModal: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen,
  chat,
  isChannel,
  isPrivateChat,
  isChatWithSelf,
  isBasicGroup,
  isSuperGroup,
  canDeleteForAll,
  contactName,
  onClose,
  leaveChannel,
  deleteHistory,
  deleteChannel,
}) => {
  const lang = useLang();
  const chatTitle = getChatTitle(lang, chat);

  const handleDeleteMessageForAll = useCallback(() => {
    deleteHistory({ chatId: chat.id, maxId: chat.lastMessage!.id, shouldDeleteForAll: true });
    onClose();
  }, [deleteHistory, chat.id, chat.lastMessage, onClose]);

  const handleDeleteChat = useCallback(() => {
    if (isPrivateChat || isBasicGroup) {
      deleteHistory({ chatId: chat.id, maxId: chat.lastMessage!.id, shouldDeleteForAll: false });
    } else if ((isChannel || isSuperGroup) && !chat.isCreator) {
      leaveChannel({ chatId: chat.id });
    } else if ((isChannel || isSuperGroup) && chat.isCreator) {
      deleteChannel({ chatId: chat.id });
    }
    onClose();
  }, [
    isPrivateChat,
    isBasicGroup,
    isChannel,
    isSuperGroup,
    chat.isCreator,
    chat.lastMessage,
    chat.id,
    onClose,
    deleteHistory,
    leaveChannel,
    deleteChannel,
  ]);

  function renderHeader() {
    return (
      <div className="modal-header">
        <Avatar
          size="tiny"
          chat={chat}
          isSavedMessages={isChatWithSelf}
        />
        <h3 className="modal-title">{lang(renderTitle())}</h3>
      </div>
    );
  }

  function renderTitle() {
    if (isChannel && !chat.isCreator) {
      return 'LeaveChannel';
    }

    if (isChannel && chat.isCreator) {
      return 'ChannelDelete';
    }

    if (isBasicGroup || isSuperGroup) {
      return 'Group.LeaveGroup';
    }

    return 'DeleteChatUser';
  }

  function renderMessage() {
    if (isChannel && chat.isCreator) {
      return <p>{renderText(lang('ChatList.DeleteAndLeaveGroupConfirmation', chatTitle), ['simple_markdown'])}</p>;
    }

    if ((isChannel && !chat.isCreator) || isBasicGroup || isSuperGroup) {
      return <p>{renderText(lang('ChannelLeaveAlertWithName', chatTitle), ['simple_markdown'])}</p>;
    }

    return <p>{renderText(lang('ChatList.DeleteChatConfirmation', contactName), ['simple_markdown'])}</p>;
  }

  function renderActionText() {
    if (isChannel && !chat.isCreator) {
      return 'LeaveChannel';
    }
    if (isChannel && chat.isCreator) {
      return 'Chat.Input.Delete';
    }

    if (isBasicGroup || isSuperGroup) {
      return 'Group.LeaveGroup';
    }

    return canDeleteForAll ? 'ChatList.DeleteForCurrentUser' : 'Delete';
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="DeleteChatModal"
      header={renderHeader()}
    >
      {renderMessage()}
      {canDeleteForAll && (
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForAll}>
          {contactName ? lang('ChatList.DeleteForEveryone', contactName) : lang('DeleteForAll')}
        </Button>
      )}
      <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteChat}>
        {lang(renderActionText())}
      </Button>
      <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chat }): StateProps => {
    const isPrivateChat = isChatPrivate(chat.id);
    const isChatWithSelf = selectIsChatWithSelf(global, chat.id);
    const canDeleteForAll = (isPrivateChat && !isChatWithSelf);
    const contactName = chat && isChatPrivate(chat.id)
      ? getUserFirstOrLastName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;

    return {
      isPrivateChat,
      isChatWithSelf,
      isChannel: isChatChannel(chat),
      isBasicGroup: isChatBasicGroup(chat),
      isSuperGroup: isChatSuperGroup(chat),
      canDeleteForAll,
      contactName,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['leaveChannel', 'deleteHistory', 'deleteChannel']),
)(DeleteChatModal));
