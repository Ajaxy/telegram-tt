/* eslint-disable react/self-closing-comp */
import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../lib/teact/teact';
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

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import RadioGroup from '../ui/RadioGroup';

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
  isChannel,
  isGroup,
  isSuperGroup,
  canPinForAll,
  contactName,
  onClose,
}) => {
  const { pinMessage } = getActions();

  const [pinForAll, setPinForAll] = useState<string>(canPinForAll ? 'everyone' : 'me');

  const lang = useLang();

  const pinOptions = [
    {
      label: lang('PinMessageForMe'),
      value: 'me',
    },
    {
      // eslint-disable-next-line max-len
      label: contactName ? renderText(lang('Conversation.PinMessagesFor', contactName)) : lang('Conversation.PinMessageAlert.PinAndNotifyMembers'),
      value: 'everyone',
    },
  ];

  const handlePin = useCallback(() => {
    pinMessage({
      messageId,
      isUnpin: false,
      isOneSide: pinForAll === 'me',
      isSilent: pinForAll === 'me',
    });
    onClose();
  }, [pinMessage, messageId, onClose, pinForAll]);

  function renderMessage() {
    if (isChannel) {
      return lang('PinMessageAlertChannel');
    }

    if (isGroup || isSuperGroup) {
      return lang('PinMessageAlert');
    }

    return lang('PinMessageAlertChat');
  }

  const handleRadioChange = (value: string) => {
    setPinForAll(value);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={handlePin}
      className="pin"
      title={lang('PinMessageAlertTitle')}
    >
      <p>{renderMessage()}</p>
      <RadioGroup
        name="pinFor"
        options={pinOptions}
        selected={pinForAll}
        // eslint-disable-next-line react/jsx-no-bind
        onChange={(value) => handleRadioChange(value)}
      />
      <div className="dialog-buttons">
        <Button
          color="primary"
          className="confirm-dialog-button"
          onClick={handlePin}
        >
          {lang('PinMessageAlertTitle')}
          <div className="hotkey-frame">
            <div className="enter-hotkey-icon"></div>
          </div>
        </Button>
        <Button
          className="confirm-dialog-button"
          color="secondary"
          isText
          onClick={onClose}
        >
          {lang('Cancel')}
        </Button>
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
