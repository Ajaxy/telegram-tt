import type { FC } from '../../lib/teact/teact';
import React, { useCallback, memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { selectChat, selectIsChatWithSelf, selectUser } from '../../global/selectors';
import {
  isUserId,
  getUserFirstOrLastName,
  getPrivateChatUserId,
  isChatBasicGroup,
  isChatSuperGroup,
  isChatChannel,
} from '../../global/helpers';
import useLang from '../../hooks/useLang';
import renderText from './helpers/renderText';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type OwnProps = {
  isOpen: boolean;
  chatId: string;
  messageId: number;
  onClose: () => void;
};

type StateProps = {
  isChannel: boolean;
  isPrivateChat: boolean;
  isChatWithSelf: boolean;
  isGroup: boolean;
  isSuperGroup: boolean;
  canPinForAll: boolean;
  contactName?: string;
};

const PinMessageModal: FC<OwnProps & StateProps> = ({
  isOpen,
  messageId,
  chatId,
  isChannel,
  isGroup,
  isSuperGroup,
  canPinForAll,
  contactName,
  onClose,
}) => {
  const { pinMessage } = getActions();

  const handlePinMessageForAll = useCallback(() => {
    pinMessage({
      chatId, messageId, isUnpin: false,
    });
    onClose();
  }, [pinMessage, chatId, messageId, onClose]);

  const handlePinMessage = useCallback(() => {
    pinMessage({
      chatId, messageId, isUnpin: false, isOneSide: true, isSilent: true,
    });
    onClose();
  }, [chatId, messageId, onClose, pinMessage]);

  const lang = useLang();

  function renderMessage() {
    if (isChannel) {
      return lang('PinMessageAlertChannel');
    }

    if (isGroup || isSuperGroup) {
      return lang('PinMessageAlert');
    }

    return lang('PinMessageAlertChat');
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="pin"
      title={lang('PinMessageAlertTitle')}
    >
      <p>{renderMessage()}</p>
      <Button className="confirm-dialog-button" isText onClick={handlePinMessage}>
        {lang('DialogPin')}
      </Button>
      {canPinForAll && (
        <Button className="confirm-dialog-button" isText onClick={handlePinMessageForAll}>
          {contactName
            ? renderText(lang('Conversation.PinMessagesFor', contactName))
            : lang('Conversation.PinMessageAlert.PinAndNotifyMembers')}
        </Button>
      )}
      <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const isPrivateChat = isUserId(chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const chat = selectChat(global, chatId);
    const isChannel = Boolean(chat) && isChatChannel(chat);
    const isGroup = Boolean(chat) && isChatBasicGroup(chat);
    const isSuperGroup = Boolean(chat) && isChatSuperGroup(chat);
    const canPinForAll = (isPrivateChat && !isChatWithSelf) || isSuperGroup || isGroup;
    const contactName = chat && isUserId(chat.id)
      ? getUserFirstOrLastName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;

    return {
      isPrivateChat,
      isChatWithSelf,
      isChannel,
      isGroup,
      isSuperGroup,
      canPinForAll,
      contactName,
    };
  },
)(PinMessageModal));
