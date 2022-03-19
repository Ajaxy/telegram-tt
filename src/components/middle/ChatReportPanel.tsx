import React, {
  FC, memo, useCallback, useState,
} from '../../lib/teact/teact';
import { withGlobal, getActions } from '../../global';

import { ApiChat, ApiChatSettings, ApiUser } from '../../api/types';

import { selectChat, selectUser } from '../../global/selectors';
import {
  getChatTitle, getUserFirstOrLastName, getUserFullName, isChatBasicGroup, isUserId,
} from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import Checkbox from '../ui/Checkbox';

import './ChatReportPanel.scss';

type OwnProps = {
  chatId: string;
  className?: string;
  settings?: ApiChatSettings;
};

type StateProps = {
  currentUserId?: string;
  chat?: ApiChat;
  user?: ApiUser;
};

const ChatReportPanel: FC<OwnProps & StateProps> = ({
  chatId, className, chat, user, settings, currentUserId,
}) => {
  const {
    openAddContactDialog,
    blockContact,
    reportSpam,
    deleteChat,
    leaveChannel,
    deleteChatUser,
    deleteHistory,
    toggleChatArchived,
    hideChatReportPanel,
  } = getActions();

  const lang = useLang();
  const [isBlockUserModalOpen, openBlockUserModal, closeBlockUserModal] = useFlag();
  const [shouldReportSpam, setShouldReportSpam] = useState<boolean>(true);
  const [shouldDeleteChat, setShouldDeleteChat] = useState<boolean>(true);
  const { accessHash } = chat || {};
  const {
    isAutoArchived, canReportSpam, canAddContact, canBlockContact,
  } = settings || {};
  const isBasicGroup = chat && isChatBasicGroup(chat);

  const handleAddContact = useCallback(() => {
    openAddContactDialog({ userId: chatId });
    if (isAutoArchived) {
      toggleChatArchived({ chatId });
    }
  }, [openAddContactDialog, isAutoArchived, toggleChatArchived, chatId]);

  const handleConfirmBlock = useCallback(() => {
    closeBlockUserModal();
    blockContact({ contactId: chatId, accessHash });
    if (canReportSpam && shouldReportSpam) {
      reportSpam({ chatId });
    }
    if (shouldDeleteChat) {
      deleteChat({ chatId });
    }
  }, [
    accessHash, blockContact, closeBlockUserModal, deleteChat, reportSpam, canReportSpam, shouldDeleteChat,
    shouldReportSpam, chatId,
  ]);

  const handleCloseReportPanel = useCallback(() => {
    hideChatReportPanel({ chatId });
  }, [chatId, hideChatReportPanel]);

  const handleChatReportSpam = useCallback(() => {
    closeBlockUserModal();
    reportSpam({ chatId });
    if (isBasicGroup) {
      deleteChatUser({ chatId, userId: currentUserId });
      deleteHistory({ chatId, shouldDeleteForAll: false });
    } else {
      leaveChannel({ chatId });
    }
  }, [
    chatId, closeBlockUserModal, currentUserId, deleteChatUser, deleteHistory, isBasicGroup, leaveChannel, reportSpam,
  ]);

  if (!settings) {
    return undefined;
  }

  return (
    <div className={buildClassName('ChatReportPanel', className)} dir={lang.isRtl ? 'rtl' : undefined}>
      {canAddContact && (
        <Button
          isText
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
          fluid
          size="tiny"
          className="UserReportPanel--Button"
          onClick={openBlockUserModal}
        >
          {lang('lng_new_contact_block')}
        </Button>
      )}
      {canReportSpam && !canBlockContact && (
        <Button
          color="danger"
          isText
          fluid
          size="tiny"
          className="UserReportPanel--Button"
          onClick={openBlockUserModal}
        >
          {lang('lng_report_spam_and_leave')}
        </Button>
      )}
      <Button
        round
        ripple
        size="tiny"
        color="translucent"
        onClick={handleCloseReportPanel}
        ariaLabel={lang('Close')}
      >
        <i className="icon-close" />
      </Button>
      <ConfirmDialog
        isOpen={isBlockUserModalOpen}
        onClose={closeBlockUserModal}
        title={lang('BlockUserTitle', user ? getUserFirstOrLastName(user) : getChatTitle(lang, chat!))}
        text={user
          ? lang('UserInfo.BlockConfirmationTitle', getUserFullName(user))
          : lang('Chat.Confirm.ReportSpam.Group')}
        isButtonsInOneRow
        confirmIsDestructive
        confirmLabel={lang('Block')}
        confirmHandler={user ? handleConfirmBlock : handleChatReportSpam}
      >
        {user && canReportSpam && (
          <Checkbox
            label={lang('DeleteReportSpam')}
            checked={shouldReportSpam}
            onCheck={setShouldReportSpam}
          />
        )}
        {user && (
          <Checkbox
            label={lang('DeleteThisChat')}
            checked={shouldDeleteChat}
            onCheck={setShouldDeleteChat}
          />
        )}
      </ConfirmDialog>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => ({
    currentUserId: global.currentUserId,
    chat: selectChat(global, chatId),
    user: isUserId(chatId) ? selectUser(global, chatId) : undefined,
  }),
)(ChatReportPanel));
