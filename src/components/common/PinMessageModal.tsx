import { memo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import {
  getPrivateChatUserId,
  getUserFirstOrLastName,
  isChatBasicGroup,
  isChatChannel,
  isChatSuperGroup,
} from '../../global/helpers';
import { selectChat, selectIsChatWithSelf, selectUser } from '../../global/selectors';
import { isUserId } from '../../util/entities/ids';
import renderText from './helpers/renderText';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
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

const PinMessageModal = ({
  isOpen,
  chatId,
  messageId,
  isChannel,
  isGroup,
  isSuperGroup,
  canPinForAll,
  contactName,
  onClose,
}: OwnProps & StateProps) => {
  const { pinMessage } = getActions();

  const [shouldPinForAll, setShouldPinForAll] = useState(true);

  const handlePinMessage = useLastCallback(() => {
    pinMessage({
      chatId,
      messageId,
      isUnpin: false,
      isOneSide: !shouldPinForAll,
      isSilent: !shouldPinForAll,
    });
    onClose();
  });

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
      {canPinForAll && (
        <Checkbox
          className="dialog-checkbox"
          label={contactName ? renderText(lang('Conversation.PinMessagesFor', contactName))
            : lang('Conversation.PinMessageAlert.PinAndNotifyMembers')}
          checked={shouldPinForAll}
          onCheck={setShouldPinForAll}
        />
      )}
      <div className="dialog-buttons">
        <Button className="confirm-dialog-button" isText onClick={handlePinMessage}>
          {lang('DialogPin')}
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
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
