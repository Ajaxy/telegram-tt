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
  onCloseAnimationEnd?: () => void;
};

type StateProps = {
  isChannel: boolean;
  isChatWithSelf?: boolean;
  isPrivateChat: boolean;
  isBasicGroup: boolean;
  isSuperGroup: boolean;
  currentUserId: number | undefined;
  canDeleteForAll?: boolean;
  contactName?: string;
};

type DispatchProps = Pick<GlobalActions, 'leaveChannel' | 'deleteHistory' | 'deleteChannel' | 'deleteChatUser'>;

const DeleteChatModal: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen,
  chat,
  isChannel,
  isPrivateChat,
  isChatWithSelf,
  isBasicGroup,
  isSuperGroup,
  currentUserId,
  canDeleteForAll,
  contactName,
  onClose,
  onCloseAnimationEnd,
  leaveChannel,
  deleteHistory,
  deleteChannel,
  deleteChatUser,
}) => {
  const lang = useLang();
  const chatTitle = getChatTitle(lang, chat);

  const handleDeleteMessageForAll = useCallback(() => {
    deleteHistory({ chatId: chat.id, shouldDeleteForAll: true });

    onClose();
  }, [deleteHistory, chat.id, onClose]);

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
      {canDeleteForAll && (
        <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteMessageForAll}>
          {contactName ? renderText(lang('ChatList.DeleteForEveryone', contactName)) : lang('DeleteForAll')}
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
      currentUserId: global.currentUserId,
      canDeleteForAll,
      contactName,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions,
    ['leaveChannel', 'deleteHistory', 'deleteChannel', 'deleteChatUser']),
)(DeleteChatModal));
