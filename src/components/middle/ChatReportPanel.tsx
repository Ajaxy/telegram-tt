import type { FC } from '../../lib/teact/teact';
import React, { memo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiChatSettings, ApiUser } from '../../api/types';

import {
  getChatTitle, getUserFirstOrLastName, getUserFullName, isChatBasicGroup,
} from '../../global/helpers';
import { selectChat, selectUser } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import ConfirmDialog from '../ui/ConfirmDialog';

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
    blockUser,
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
  const {
    isAutoArchived, canReportSpam, canAddContact, canBlockContact,
  } = settings || {};
  const isBasicGroup = chat && isChatBasicGroup(chat);

  const handleAddContact = useLastCallback(() => {
    openAddContactDialog({ userId: chatId });
    if (isAutoArchived) {
      toggleChatArchived({ id: chatId });
    }
  });

  const handleConfirmBlock = useLastCallback(() => {
    closeBlockUserModal();
    blockUser({ userId: chatId });
    if (canReportSpam && shouldReportSpam) {
      reportSpam({ chatId });
    }
    if (shouldDeleteChat) {
      deleteChat({ chatId });
    }
  });

  const handleCloseReportPanel = useLastCallback(() => {
    hideChatReportPanel({ chatId });
  });

  const handleChatReportSpam = useLastCallback(() => {
    closeBlockUserModal();
    reportSpam({ chatId });
    if (isBasicGroup) {
      deleteChatUser({ chatId, userId: currentUserId! });
      deleteHistory({ chatId, shouldDeleteForAll: false });
    } else {
      leaveChannel({ chatId });
    }
  });

  if (!settings || (!chat && !user)) {
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
        <i className="icon icon-close" />
      </Button>
      <ConfirmDialog
        isOpen={isBlockUserModalOpen}
        onClose={closeBlockUserModal}
        title={lang('BlockUserTitle', user ? getUserFirstOrLastName(user) : getChatTitle(lang, chat!))}
        text={user
          ? lang('UserInfo.BlockConfirmationTitle', getUserFullName(user))
          : lang('Chat.Confirm.ReportSpam.Channel')}
        confirmIsDestructive
        confirmLabel={lang('Block')}
        confirmHandler={user ? handleConfirmBlock : handleChatReportSpam}
      >
        {user && (
          <Checkbox
            label={lang('DeleteThisChat')}
            checked={shouldDeleteChat}
            onCheck={setShouldDeleteChat}
          />
        )}
        {user && canReportSpam && (
          <Checkbox
            label={lang('ReportChat')}
            checked={shouldReportSpam}
            onCheck={setShouldReportSpam}
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
    user: selectUser(global, chatId),
  }),
)(ChatReportPanel));
