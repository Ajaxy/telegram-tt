import type { FC } from '../../lib/teact/teact';
import { memo, useCallback } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat } from '../../api/types';

import { getUserFirstOrLastName } from '../../global/helpers';
import { selectCurrentChat, selectUser } from '../../global/selectors';
import renderText from '../common/helpers/renderText';

import useOldLang from '../../hooks/useOldLang';

import ConfirmDialog from '../ui/ConfirmDialog';

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

  const lang = useOldLang();

  const handleDeleteChatMember = useCallback(() => {
    deleteChatMember({ chatId: chat!.id, userId: userId! });
    onClose();
  }, [chat, deleteChatMember, onClose, userId]);

  if (!chat || !userId) {
    return undefined;
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      title={lang('GroupRemoved.Remove')}
      textParts={renderText(lang('PeerInfo.Confirm.RemovePeer', contactName))}
      confirmLabel={lang('lng_box_remove')}
      confirmHandler={handleDeleteChatMember}
      confirmIsDestructive
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): Complete<StateProps> => {
    const chat = selectCurrentChat(global);
    const user = userId && selectUser(global, userId);
    const contactName = user ? getUserFirstOrLastName(user) : undefined;

    return {
      chat,
      contactName,
    };
  },
)(DeleteMemberModal));
