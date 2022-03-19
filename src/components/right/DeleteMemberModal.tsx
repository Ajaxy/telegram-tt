import React, { FC, useCallback, memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../modules';

import { ApiChat } from '../../api/types';

import { selectCurrentChat, selectUser } from '../../modules/selectors';
import { getUserFirstOrLastName } from '../../modules/helpers';
import renderText from '../common/helpers/renderText';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

export type OwnProps = {
  isOpen: boolean;
  userId?: string;
  onClose: () => void;
};

type StateProps = {
  chat?: ApiChat;
  contactName?: string;
};

const DeleteMemberModal: FC<OwnProps & StateProps> = ({
  isOpen,
  chat,
  userId,
  contactName,
  onClose,
}) => {
  const { deleteChatMember } = getActions();

  const lang = useLang();

  const handleDeleteChatMember = useCallback(() => {
    deleteChatMember({ chatId: chat!.id, userId });
    onClose();
  }, [chat, deleteChatMember, onClose, userId]);

  if (!chat || !userId) {
    return undefined;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onEnter={handleDeleteChatMember}
      className="delete"
      title={lang('GroupRemoved.Remove')}
    >
      <p>{renderText(lang('PeerInfo.Confirm.RemovePeer', contactName))}</p>
      <Button color="danger" className="confirm-dialog-button" isText onClick={handleDeleteChatMember}>
        {lang('lng_box_remove')}
      </Button>
      <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    const chat = selectCurrentChat(global);
    const user = userId && selectUser(global, userId);
    const contactName = user ? getUserFirstOrLastName(user) : undefined;

    return {
      chat,
      contactName,
    };
  },
)(DeleteMemberModal));
