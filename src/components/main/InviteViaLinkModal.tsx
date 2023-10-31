import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiUser } from '../../api/types';

import { getUserFullName } from '../../global/helpers';
import { selectCurrentChat, selectUser } from '../../global/selectors';

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
  chat?: ApiChat;
};

const InviteViaLinkModal: FC<OwnProps & StateProps> = ({ isOpen, users, userIds }) => {
  const { closeInviteViaLinkModal } = getActions();

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(userIds);

  const handleClose = useCallback(() => {
    closeInviteViaLinkModal();
  }, []);

  const handleClickSkip = useCallback(() => {
    closeInviteViaLinkModal();
  }, []);

  const handleClickSendInviteLink = useCallback(() => {
    return selectedMemberIds;
    closeInviteViaLinkModal();
  }, [selectedMemberIds]);

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
      />
      <div className="dialog-buttons">
        <Button
          className="confirm-dialog-button"
          type="submit"
          isText
          onClick={handleClickSendInviteLink}
        >
          Send Invite Link
        </Button>
        <Button className="confirm-dialog-button" isText onClick={handleClickSkip}>Skip</Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      userIds: global.restrictedInviteUserIds,
      users: global.restrictedInviteUserIds.map((userId) => selectUser(global, userId)).filter(Boolean),
      chat: selectCurrentChat(global),
    };
  },
)(InviteViaLinkModal));
