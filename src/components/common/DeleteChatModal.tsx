import type { FC } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat } from '../../api/types';

import {
  getChatTitle,
  getPrivateChatUserId,
  getUserFirstOrLastName,
  isChatBasicGroup,
  isChatChannel,
  isChatSuperGroup,
  isUserBot,
} from '../../global/helpers';
import { selectIsChatWithSelf, selectUser } from '../../global/selectors';
import { isUserId } from '../../util/entities/ids';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Avatar from './Avatar';

import './DeleteChatModal.scss';

export type OwnProps = {
  isOpen: boolean;
  chat: ApiChat;
  isSavedDialog?: boolean;
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
  isSavedDialog,
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
    deleteSavedHistory,
    deleteChannel,
    deleteChatUser,
    blockUser,
    deleteChat,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();
  const chatTitle = getChatTitle(lang, chat);

  const handleDeleteForAll = useLastCallback(() => {
    deleteHistory({ chatId: chat.id, shouldDeleteForAll: true });

    onClose();
  });

  const handleDeleteAndStop = useLastCallback(() => {
    deleteHistory({ chatId: chat.id, shouldDeleteForAll: true });
    blockUser({ userId: chat.id });

    onClose();
  });

  const handleDeleteChat = useLastCallback(() => {
    if (isSavedDialog) {
      deleteSavedHistory({ chatId: chat.id });
    } else if (isPrivateChat) {
      deleteHistory({ chatId: chat.id, shouldDeleteForAll: false });
    } else if (isBasicGroup) {
      if (chat.isCreator) {
        deleteHistory({ chatId: chat.id, shouldDeleteForAll: true });
        deleteChat({ chatId: chat.id });
      } else {
        deleteHistory({ chatId: chat.id, shouldDeleteForAll: false });
        deleteChatUser({ chatId: chat.id, userId: currentUserId! });
      }
    } else if ((isChannel || isSuperGroup) && !chat.isCreator) {
      leaveChannel({ chatId: chat.id });
    } else if ((isChannel || isSuperGroup) && chat.isCreator) {
      deleteChannel({ chatId: chat.id });
    }
    onClose();
  });

  const handleLeaveChat = useLastCallback(() => {
    if (isChannel || isSuperGroup) {
      leaveChannel({ chatId: chat.id });
      onClose();
    } else if (isBasicGroup && chat.isCreator) {
      deleteHistory({ chatId: chat.id, shouldDeleteForAll: false });
      deleteChatUser({ chatId: chat.id, userId: currentUserId! });
    } else {
      handleDeleteChat();
    }
  });

  function renderHeader() {
    return (
      <div className="modal-header" dir={lang.isRtl ? 'rtl' : undefined}>
        <Avatar
          size="tiny"
          peer={chat}
          isSavedMessages={isChatWithSelf}
        />
        <h3 className="modal-title">{oldLang(renderTitle())}</h3>
      </div>
    );
  }

  function renderTitle() {
    if (isSavedDialog) {
      return isChatWithSelf ? 'ClearHistoryMyNotesTitle' : 'ClearHistoryTitleSingle2';
    }

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

  function renderContent() {
    if (isSavedDialog) {
      return (
        <p>
          {renderText(
            isChatWithSelf ? oldLang('ClearHistoryMyNotesMessage') : oldLang('ClearHistoryMessageSingle', chatTitle),
            ['simple_markdown', 'emoji'],
          )}
        </p>
      );
    }
    if (isChannel && chat.isCreator) {
      return (
        <p>
          {renderText(oldLang('ChatList.DeleteAndLeaveGroupConfirmation', chatTitle), ['simple_markdown', 'emoji'])}
        </p>
      );
    }

    if ((isChannel && !chat.isCreator) || isBasicGroup || isSuperGroup) {
      return <p>{renderText(oldLang('ChannelLeaveAlertWithName', chatTitle), ['simple_markdown', 'emoji'])}</p>;
    }

    return <p>{renderText(oldLang('ChatList.DeleteChatConfirmation', contactName), ['simple_markdown', 'emoji'])}</p>;
  }

  function renderActionText() {
    if (isSavedDialog) {
      return 'Delete';
    }

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
      {renderContent()}
      <div className="dialog-buttons-column">
        {isBot && !isSavedDialog && (
          <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteAndStop}>
            {oldLang('DeleteAndStop')}
          </Button>
        )}
        {canDeleteForAll && (
          <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteForAll}>
            {contactName ? renderText(oldLang('ChatList.DeleteForEveryone', contactName)) : oldLang('DeleteForAll')}
          </Button>
        )}
        {!isPrivateChat && chat.isCreator && !isSavedDialog && (
          <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteChat}>
            {oldLang('DeleteForAll')}
          </Button>
        )}
        <Button
          color="danger"
          className="confirm-dialog-button"
          isText
          onClick={(isPrivateChat || isSavedDialog) ? handleDeleteChat : handleLeaveChat}
        >
          {oldLang(renderActionText())}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{oldLang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chat, isSavedDialog }): Complete<StateProps> => {
    const isPrivateChat = isUserId(chat.id);
    const isChatWithSelf = selectIsChatWithSelf(global, chat.id);
    const user = isPrivateChat && selectUser(global, getPrivateChatUserId(chat)!);
    const isBot = user && isUserBot(user) && !chat.isSupport;
    const canDeleteForAll = (isPrivateChat && !isChatWithSelf && !isBot && !isSavedDialog);
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
