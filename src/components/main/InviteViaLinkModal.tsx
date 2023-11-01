import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';

import { getUserFullName } from '../../global/helpers';
import { selectChatFullInfo, selectCurrentChat, selectUser } from '../../global/selectors';

import useLastCallback from '../../hooks/useLastCallback';

import Picker from '../common/Picker';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

import './InviteViaLinkModal.scss';

export type OwnProps = {
  isOpen?: boolean;
};

type StateProps = {
  userIds: string[];
  users: ApiUser[];
  chatInviteLink?: string;
};

const InviteViaLinkModal: FC<OwnProps & StateProps> = ({
  isOpen, users, userIds, chatInviteLink,
}) => {
  const { closeInviteViaLinkModal, sendMessage } = getActions();

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(userIds);

  const handleClose = useLastCallback(() => {
    closeInviteViaLinkModal();
  });

  const handleClickSkip = useLastCallback(() => {
    closeInviteViaLinkModal();
  });

  const handleClickSendInviteLink = useCallback(() => {
    selectedMemberIds.forEach((userId) => sendMessage({ chatId: userId, text: chatInviteLink }));
    closeInviteViaLinkModal();
  }, [selectedMemberIds, chatInviteLink]);

  const userNames = useMemo(() => {
    return users.map((user) => getUserFullName(user)).join(', ');
  }, [users]);

  return (
    <Modal
      isOpen={isOpen}
      title="Invite via Link"
      onClose={handleClose}
      className="InviteViaLinkModal"
    >
      <p className="modal-content-text">
        <span className="bold-user-names">{userNames} </span>
        restricts adding them to groups.<br />
        You can send them an invite link as message instead.
      </p>
      <Picker
        itemIds={userIds}
        selectedIds={selectedMemberIds}
        onSelectedIdsChange={setSelectedMemberIds}
        isRoundCheckbox
      />
      <div className="dialog-buttons">
        <Button
          className="confirm-dialog-button"
          isText
          onClick={handleClickSendInviteLink}
          disabled={!selectedMemberIds.length}
        >
          Send Invite Link
        </Button>
        <Button
          className="confirm-dialog-button"
          isText
          onClick={handleClickSkip}
        >
          Skip
        </Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const chat = selectCurrentChat(global);
    const chatFullInfo = selectChatFullInfo(global, chat!.id);
    return {
      userIds: global.restrictedInviteUserIds,
      users: global.restrictedInviteUserIds.map((userId) => selectUser(global, userId)).filter(Boolean),
      chatInviteLink: chatFullInfo?.inviteLink,
    };
  },
)(InviteViaLinkModal));
