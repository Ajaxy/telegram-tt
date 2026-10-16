import { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiUser } from '../../api/types';
import type { RegularLangKey } from '../../types/language';

import {
  getChatTitle,
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
  contactUser?: ApiUser;
};

const DeleteChatModal = ({
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
  contactUser,
  onClose,
  onCloseAnimationEnd,
}: OwnProps & StateProps) => {
  const {
    leaveChannel,
    leaveBasicGroup,
    deleteHistory,
    deleteSavedHistory,
    deleteChannel,
    deleteChatUser,
    blockUser,
    deleteChat,
  } = getActions();

  const lang = useLang();
  const contactName = getUserFirstOrLastName(lang, contactUser);
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
      if (chat.isOwner) {
        deleteHistory({ chatId: chat.id, shouldDeleteForAll: true });
        deleteChat({ chatId: chat.id });
      } else {
        deleteHistory({ chatId: chat.id, shouldDeleteForAll: false });
        deleteChatUser({ chatId: chat.id, userId: currentUserId! });
      }
    } else if ((isChannel || isSuperGroup) && !chat.isOwner) {
      leaveChannel({ chatId: chat.id });
    } else if ((isChannel || isSuperGroup) && chat.isOwner) {
      deleteChannel({ chatId: chat.id });
    }
    onClose();
  });

  const handleLeaveChat = useLastCallback(() => {
    if (isChannel || isSuperGroup) {
      leaveChannel({ chatId: chat.id });
      onClose();
    } else if (isBasicGroup && chat.isOwner) {
      leaveBasicGroup({ chatId: chat.id });
      onClose();
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
        <h3 className="modal-title">{lang(renderTitle())}</h3>
      </div>
    );
  }

  function renderTitle(): RegularLangKey {
    if (isSavedDialog) {
      return isChatWithSelf ? 'ClearHistoryMyNotesTitle' : 'ClearHistoryTitleSingle2';
    }

    if (isChannel && !chat.isOwner) {
      return 'ChannelLeave';
    }

    if (isChannel && chat.isOwner) {
      return 'ChannelDelete';
    }

    if (isBasicGroup || isSuperGroup) {
      return 'GroupLeaveGroup';
    }

    return 'DeleteChat';
  }

  function renderContent() {
    if (isSavedDialog) {
      return (
        <p>
          {renderText(
            isChatWithSelf ? lang('ClearHistoryMyNotesMessage')
              : lang('ClearHistoryMessageSingle', { chat: chatTitle }),
            ['simple_markdown', 'emoji'],
          )}
        </p>
      );
    }
    if (isChannel && chat.isOwner) {
      return (
        <p>
          {renderText(lang('ChatListDeleteAndLeaveGroupConfirmation', {
            chat: chatTitle,
          }), ['simple_markdown', 'emoji'])}
        </p>
      );
    }

    if ((isChannel && !chat.isOwner) || isBasicGroup || isSuperGroup) {
      return <p>{renderText(lang('ChannelLeaveAlertWithName', { chat: chatTitle }), ['simple_markdown', 'emoji'])}</p>;
    }

    return (
      <p>{renderText(lang('ChatListDeleteChatConfirmation', { chat: contactName }), ['simple_markdown', 'emoji'])}</p>
    );
  }

  function renderActionText(): RegularLangKey {
    if (isSavedDialog) {
      return 'Delete';
    }

    if (isChannel && !chat.isOwner) {
      return 'ChannelLeave';
    }
    if (isChannel && chat.isOwner) {
      return 'Delete';
    }

    if (isBasicGroup || isSuperGroup) {
      return 'GroupLeaveGroup';
    }

    return canDeleteForAll ? 'ChatListDeleteForCurrentUser' : 'Delete';
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
            {lang('DeleteAndStop')}
          </Button>
        )}
        {canDeleteForAll && (
          <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteForAll}>
            {contactName ? renderText(lang('ChatListDeleteForEveryone', { user: contactName })) : lang('DeleteForAll')}
          </Button>
        )}
        {!isPrivateChat && chat.isOwner && !isSavedDialog && (
          <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteChat}>
            {lang('DeleteForAll')}
          </Button>
        )}
        <Button
          color="danger"
          className="confirm-dialog-button"
          isText
          onClick={(isPrivateChat || isSavedDialog) ? handleDeleteChat : handleLeaveChat}
        >
          {lang(renderActionText())}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chat, isSavedDialog }): Complete<StateProps> => {
    const isPrivateChat = isUserId(chat.id);
    const isChatWithSelf = selectIsChatWithSelf(global, chat.id);
    const user = selectUser(global, chat.id);
    const isBot = user && isUserBot(user) && !chat.isSupport;
    const canDeleteForAll = (isPrivateChat && !isChatWithSelf && !isBot && !isSavedDialog);
    const contactUser = isPrivateChat ? user : undefined;

    return {
      isPrivateChat,
      isChatWithSelf,
      isBot,
      isChannel: isChatChannel(chat),
      isBasicGroup: isChatBasicGroup(chat),
      isSuperGroup: isChatSuperGroup(chat),
      currentUserId: global.currentUserId,
      canDeleteForAll,
      contactUser,
    };
  },
)(DeleteChatModal));
