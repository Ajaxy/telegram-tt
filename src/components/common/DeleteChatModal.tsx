import React, { FC, useCallback, memo } from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import { ApiChat } from '../../api/types';

import { selectIsChatWithSelf, selectUser } from '../../modules/selectors';
import {
  isUserId,
  isUserBot,
  getUserFirstOrLastName,
  getPrivateChatUserId,
  isChatBasicGroup,
  isChatSuperGroup,
  isChatChannel,
  getChatTitle,
} from '../../modules/helpers';
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
  onCloseAnimationEnd?: () => void;
};

type StateProps = {
  isChannel: boolean;
  isChatWithSelf?: boolean;
  isBot?: boolean;
  isPrivateChat: boolean;
  isBasicGroup: boolean;
  isSuperGroup: boolean;
  currentUserId: string | undefined;
  canDeleteForAll?: boolean;
  contactName?: string;
};

const DeleteChatModal: FC<OwnProps & StateProps> = ({
  isOpen,
  chat,
  isChannel,
  isPrivateChat,
  isChatWithSelf,
  isBot,
  isBasicGroup,
  isSuperGroup,
  currentUserId,
  canDeleteForAll,
  contactName,
  onClose,
  onCloseAnimationEnd,
}) => {
  const {
    leaveChannel,
    deleteHistory,
    deleteChannel,
    deleteChatUser,
    blockContact,
  } = getDispatch();

  const lang = useLang();
  const chatTitle = getChatTitle(lang, chat);

  const handleDeleteMessageForAll = useCallback(() => {
    deleteHistory({ chatId: chat.id, shouldDeleteForAll: true });

    onClose();
  }, [deleteHistory, chat.id, onClose]);

  const handleDeleteAndStop = useCallback(() => {
    deleteHistory({ chatId: chat.id, shouldDeleteForAll: true });
    blockContact({ contactId: chat.id, accessHash: chat.accessHash });

    onClose();
  }, [deleteHistory, chat.id, chat.accessHash, blockContact, onClose]);

  const handleDeleteChat = useCallback(() => {
    if (isPrivateChat) {
      deleteHistory({ chatId: chat.id, shouldDeleteForAll: false });
    } else if (isBasicGroup) {
      deleteChatUser({ chatId: chat.id, userId: currentUserId });
      deleteHistory({ chatId: chat.id, shouldDeleteForAll: false });
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
    currentUserId,
    chat.isCreator,
    chat.id,
    onClose,
    deleteHistory,
    deleteChatUser,
    leaveChannel,
    deleteChannel,
  ]);

  const handleLeaveChat = useCallback(() => {
    if (isChannel || isSuperGroup) {
      leaveChannel({ chatId: chat.id });
    } else {
      handleDeleteChat
    }
    onClose();
  }, [
    isPrivateChat,
    isBasicGroup,
    isChannel,
    isSuperGroup,
    currentUserId,
    chat.id,
    onClose,
    leaveChannel,
  ]);

  function renderHeader() {
    return (
      <div className="modal-header" dir={lang.isRtl ? 'rtl' : undefined}>
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
      className="DeleteChatModal"
      header={renderHeader()}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      {renderMessage()}
      {isBot && (
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteAndStop}>
          {lang('DeleteAndStop')}
        </Button>
      )}
      {canDeleteForAll && (
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForAll}>
          {contactName ? renderText(lang('ChatList.DeleteForEveryone', contactName)) : lang('DeleteForAll')}
        </Button>
      )}
      {!isPrivateChat && chat.isCreator && (
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteChat}>
          {lang('DeleteForAll')}
        </Button>
      )}
      <Button color="danger" className="confirm-dialog-button" isText onClick={isPrivateChat ? handleDeleteChat : handleLeaveChat}>
        {lang(renderActionText())}
      </Button>
      <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chat }): StateProps => {
    const isPrivateChat = isUserId(chat.id);
    const isChatWithSelf = selectIsChatWithSelf(global, chat.id);
    const user = isPrivateChat && selectUser(global, getPrivateChatUserId(chat)!);
    const isBot = user && isUserBot(user) && !chat.isSupport;
    const canDeleteForAll = (isPrivateChat && !isChatWithSelf && !isBot);
    const contactName = isPrivateChat
      ? getUserFirstOrLastName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;

    return {
      isPrivateChat,
      isChatWithSelf,
      isBot,
      isChannel: isChatChannel(chat),
      isBasicGroup: isChatBasicGroup(chat),
      isSuperGroup: isChatSuperGroup(chat),
      currentUserId: global.currentUserId,
      canDeleteForAll,
      contactName,
    };
  },
)(DeleteChatModal));
