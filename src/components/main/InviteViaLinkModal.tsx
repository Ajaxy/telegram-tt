import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback,
  useEffect,
  useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import { getUserFullName } from '../../global/helpers';
import { selectChat } from '../../global/selectors';
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
  const handleSkip = useLastCallback(() => closeInviteViaLinkModal());

  const handleSendInviteLink = useCallback(() => {
    sendInviteMessages({ chatId: chatId!, userIds: selectedMemberIds! });
    closeInviteViaLinkModal();
  }, [selectedMemberIds, chatId]);

  const userNames = useMemo(() => {
    const usersById = getGlobal().users.byId;
    return userIds?.map((userId) => getUserFullName(usersById[userId])).join(', ');
  }, [userIds]);

  const canSendInviteLink = useMemo(() => {
    if (!chatId) {
      return false;
    }
    const chat = selectChat(getGlobal(), chatId);
    return Boolean(chat?.isCreator || chat?.adminRights?.inviteUsers);
  }, [chatId]);

  const contentText = useMemo(() => {
    const langKey = canSendInviteLink
      ? 'SendInviteLink.TextAvailableSingleUser'
      : 'SendInviteLink.TextUnavailableSingleUser';
    return renderText(lang(langKey, userNames), ['simple_markdown']);
  }, [userNames, lang, canSendInviteLink]);

  return (
    <Modal
      isOpen={Boolean(userIds && chatId)}
      title={canSendInviteLink ? lang('SendInviteLink.InviteTitle') : lang('SendInviteLink.LinkUnavailableTitle')}
      onClose={handleClose}
      isSlim
    >
      <p className={styles.contentText}>
        {contentText}
      </p>
      <Picker
        className={styles.userPicker}
        itemIds={userIds!}
        selectedIds={selectedMemberIds}
        onSelectedIdsChange={setSelectedMemberIds}
        isViewOnly={!canSendInviteLink}
        isRoundCheckbox
      />
      <div className="dialog-buttons">
        {canSendInviteLink && (
          <Button
            className="confirm-dialog-button"
            isText
            onClick={handleSendInviteLink}
            disabled={!selectedMemberIds.length}
          >
            {lang('SendInviteLink.ActionInvite')}
          </Button>
        )}
        {canSendInviteLink && (
          <Button
            className="confirm-dialog-button"
            isText
            onClick={handleSkip}
          >
            {lang('SendInviteLink.ActionSkip')}
          </Button>
        )}
        {!canSendInviteLink && (
          <Button
            className="confirm-dialog-button"
            isText
            onClick={handleClose}
          >
            {lang('SendInviteLink.ActionClose')}
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default memo(InviteViaLinkModal);
