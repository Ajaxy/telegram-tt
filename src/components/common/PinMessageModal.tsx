import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import {
  getPrivateChatUserId,
  getUserFirstOrLastName,
  isChatBasicGroup,
  isChatChannel,
  isChatSuperGroup,
  isUserId,
} from '../../global/helpers';
import { selectChat, selectIsChatWithSelf, selectUser } from '../../global/selectors';
import renderText from './helpers/renderText';

import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

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
  chatId,
  messageId,
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
  }, [chatId, messageId, onClose]);

  const handlePinMessage = useCallback(() => {
    pinMessage({
      chatId, messageId, isUnpin: false, isOneSide: true, isSilent: true,
    });
    onClose();
  }, [chatId, messageId, onClose]);

  const lang = useOldLang();

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
      <div className="dialog-buttons-column">
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
      </div>
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
