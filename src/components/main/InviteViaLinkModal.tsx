import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback,
  useEffect,
  useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import { getUserFullName } from '../../global/helpers';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Picker from '../common/Picker';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

import styles from './InviteViaLinkModal.module.scss';

export type OwnProps = {
  chatId?: string;
  userIds?: string[];
};

const InviteViaLinkModal: FC<OwnProps> = ({
  chatId, userIds,
}) => {
  const { sendInviteMessages, closeInviteViaLinkModal } = getActions();

  const lang = useLang();
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (userIds) {
      setSelectedMemberIds(userIds);
    }
  }, [userIds]);

  const handleClose = useLastCallback(() => closeInviteViaLinkModal());
  const handleClickSkip = useLastCallback(() => closeInviteViaLinkModal());

  const handleClickSendInviteLink = useCallback(() => {
    sendInviteMessages({ chatId: chatId!, userIds: selectedMemberIds! });
    closeInviteViaLinkModal();
  }, [selectedMemberIds, chatId]);

  const userNames = useMemo(() => {
    const usersById = getGlobal().users.byId;
    return userIds?.map((userId) => getUserFullName(usersById[userId])).join(', ');
  }, [userIds]);

  return (
    <Modal
      isOpen={Boolean(userIds && chatId)}
      title={lang('SendInviteLink.InviteTitle')}
      onClose={handleClose}
      isSlim
    >
      <p className={styles.contentText}>
        {renderText(lang('SendInviteLink.TextAvailableSingleUser', userNames), ['simple_markdown'])}
      </p>
      <Picker
        itemIds={userIds!}
        selectedIds={selectedMemberIds ?? []}
        onSelectedIdsChange={setSelectedMemberIds}
      />
      <div className="dialog-buttons">
        <Button
          className="confirm-dialog-button"
          isText
          onClick={handleClickSendInviteLink}
          disabled={!selectedMemberIds?.length}
        >
          {lang('SendInviteLink.ActionInvite')}
        </Button>
        <Button
          className="confirm-dialog-button"
          isText
          onClick={handleClickSkip}
        >
          {lang('SendInviteLink.ActionSkip')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(InviteViaLinkModal);
