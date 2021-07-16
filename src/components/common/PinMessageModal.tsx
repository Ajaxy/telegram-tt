import React, { FC, useCallback, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';

import { selectChat, selectIsChatWithSelf, selectUser } from '../../modules/selectors';
import {
  isChatPrivate,
  getUserFirstOrLastName,
  getPrivateChatUserId,
  isChatBasicGroup,
  isChatSuperGroup,
  isChatChannel,
} from '../../modules/helpers';
import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';
import renderText from './helpers/renderText';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type OwnProps = {
  isOpen: boolean;
  chatId: number;
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

type DispatchProps = Pick<GlobalActions, 'pinMessage'>;

const PinMessageModal: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen,
  messageId,
  chatId,
  isChannel,
  isGroup,
  isSuperGroup,
  canPinForAll,
  contactName,
  onClose,
  pinMessage,
}) => {
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
    const isPrivateChat = isChatPrivate(chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const chat = selectChat(global, chatId);
    const isChannel = !!chat && isChatChannel(chat);
    const isGroup = !!chat && isChatBasicGroup(chat);
    const isSuperGroup = !!chat && isChatSuperGroup(chat);
    const canPinForAll = (isPrivateChat && !isChatWithSelf) || isSuperGroup || isGroup;
    const contactName = chat && isChatPrivate(chat.id)
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
  (setGlobal, actions): DispatchProps => pick(actions, ['pinMessage']),
)(PinMessageModal));
