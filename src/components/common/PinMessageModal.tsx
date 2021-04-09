import React, { FC, useCallback, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';

import { selectChat, selectIsChatWithSelf, selectUser } from '../../modules/selectors';
import {
  isChatPrivate,
  getUserFirstName,
  getPrivateChatUserId,
  isChatBasicGroup,
  isChatSuperGroup,
  isChatChannel,
} from '../../modules/helpers';
import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

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
  contactFirstName?: string;
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
  contactFirstName,
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

  function renderModalHeader() {
    return (
      <div className="modal-header">
        <h3 className="modal-title">{lang('PinMessageAlertTitle')}</h3>
      </div>
    );
  }

  function renderMessage() {
    if (isChannel) {
      return <p>{lang('PinMessageAlertChannel')}</p>;
    }

    if (isGroup || isSuperGroup) {
      return <p>{lang('PinMessageAlert')}</p>;
    }

    return <p>{lang('PinMessageAlertChat')}</p>;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="pin"
      header={renderModalHeader()}
    >
      {renderMessage()}
      <Button className="confirm-dialog-button" isText onClick={handlePinMessage}>
        {lang('DialogPin')}
      </Button>
      {canPinForAll && (
        <Button className="confirm-dialog-button" isText onClick={handlePinMessageForAll}>
          {contactFirstName ? `Pin for me and ${contactFirstName}` : 'Pin and notify all memebers'}
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
    const contactFirstName = chat && isChatPrivate(chat.id)
      ? getUserFirstName(selectUser(global, getPrivateChatUserId(chat)!))
      : undefined;

    return {
      isPrivateChat,
      isChatWithSelf,
      isChannel,
      isGroup,
      isSuperGroup,
      canPinForAll,
      contactFirstName,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['pinMessage']),
)(PinMessageModal));
