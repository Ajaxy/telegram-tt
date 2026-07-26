import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getPeerTitle } from '../../../global/helpers/peers';
import { selectPeer } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ConfirmDialog from '../../ui/ConfirmDialog';

export type OwnProps = {
  modal: TabState['deleteMemberModal'];
};

type StateProps = {
  peer?: ApiPeer;
};

const DeleteMemberModal = ({
  modal,
  peer,
}: OwnProps & StateProps) => {
  const { deleteChatMember, closeDeleteMemberModal } = getActions();

  const lang = useLang();

  const isOpen = Boolean(modal);
  const peerName = peer && getPeerTitle(lang, peer);

  const handleDeleteChatMember = useLastCallback(() => {
    if (!modal) {
      return;
    }

    deleteChatMember({ chatId: modal.chatId, peerId: modal.peerId });
    closeDeleteMemberModal();
  });

  const handleClose = useLastCallback(() => {
    closeDeleteMemberModal();
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={lang('RemoveMember')}
      textParts={lang('PeerInfoConfirmRemovePeer', { user: peerName })}
      confirmLabel={lang('BoxRemove')}
      confirmHandler={handleDeleteChatMember}
      confirmIsDestructive
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const peer = modal?.peerId ? selectPeer(global, modal.peerId) : undefined;

    return {
      peer,
    };
  },
)(DeleteMemberModal));
