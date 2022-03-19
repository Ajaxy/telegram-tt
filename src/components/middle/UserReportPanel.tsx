import React, {
  FC, memo, useCallback, useState,
} from '../../lib/teact/teact';
import { withGlobal, getDispatch } from '../../lib/teact/teactn';

import { ApiUser } from '../../api/types';

import { selectUser } from '../../modules/selectors';
import { getUserFirstOrLastName, getUserFullName } from '../../modules/helpers';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import Checkbox from '../ui/Checkbox';

import './UserReportPanel.scss';

type OwnProps = {
  userId: string;
};

type StateProps = {
  user?: ApiUser;
};

const UserReportPanel: FC<OwnProps & StateProps> = ({ userId, user }) => {
  const {
    addContact,
    blockContact,
    reportSpam,
    deleteChat,
    toggleChatArchived,
  } = getDispatch();

  const lang = useLang();
  const [isBlockUserModalOpen, openBlockUserModal, closeBlockUserModal] = useFlag();
  const [shouldReportSpam, setShouldReportSpam] = useState<boolean>(true);
  const [shouldDeleteChat, setShouldDeleteChat] = useState<boolean>(true);
  const { settings, accessHash } = user || {};
  const {
    isAutoArchived, canReportSpam, canAddContact, canBlockContact,
  } = settings || {};
  const handleAddContact = useCallback(() => {
    addContact({ userId });
    if (isAutoArchived) {
      toggleChatArchived({ chatId: userId });
    }
  }, [addContact, isAutoArchived, toggleChatArchived, userId]);

  const handleConfirmBlock = useCallback(() => {
    closeBlockUserModal();
    blockContact({ contactId: userId, accessHash });
    if (canReportSpam && shouldReportSpam) {
      reportSpam({ userId });
    }
    if (shouldDeleteChat) {
      deleteChat({ chatId: userId });
    }
  }, [
    accessHash, blockContact, closeBlockUserModal, deleteChat, reportSpam, canReportSpam, shouldDeleteChat,
    shouldReportSpam, userId,
  ]);

  if (!settings) {
    return undefined;
  }

  return (
    <div className="UserReportPanel">
      {canAddContact && (
        <Button
          isText
          ripple
          fluid
          size="tiny"
          className="UserReportPanel--Button"
          onClick={handleAddContact}
        >
          {lang('lng_new_contact_add')}
        </Button>
      )}
      {canBlockContact && (
        <Button
          color="danger"
          isText
          ripple
          fluid
          size="tiny"
          className="UserReportPanel--Button"
          onClick={openBlockUserModal}
        >
          {lang('lng_new_contact_block')}
        </Button>
      )}
      <ConfirmDialog
        isOpen={isBlockUserModalOpen}
        onClose={closeBlockUserModal}
        title={lang('BlockUserTitle', getUserFirstOrLastName(user))}
        text={lang('UserInfo.BlockConfirmationTitle', getUserFullName(user))}
        isButtonsInOneRow
        confirmIsDestructive
        confirmLabel={lang('Block')}
        confirmHandler={handleConfirmBlock}
      >
        {canReportSpam && (
          <Checkbox
            label={lang('DeleteReportSpam')}
            checked={shouldReportSpam}
            onCheck={setShouldReportSpam}
          />
        )}
        <Checkbox
          label={lang('DeleteThisChat')}
          checked={shouldDeleteChat}
          onCheck={setShouldDeleteChat}
        />
      </ConfirmDialog>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => ({ user: selectUser(global, userId) }),
)(UserReportPanel));
