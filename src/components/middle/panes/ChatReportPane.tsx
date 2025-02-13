import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';

import {
  getChatTitle, getUserFirstOrLastName, getUserFullName, isChatBasicGroup,
} from '../../../global/helpers';
import { isApiPeerChat, isApiPeerUser } from '../../../global/helpers/peers';
import { selectPeer } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';

import './ChatReportPane.scss';

type OwnProps = {
  chatId: string;
  className?: string;
  isAutoArchived?: boolean;
  canReportSpam?: boolean;
  canAddContact?: boolean;
  canBlockContact?: boolean;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  currentUserId?: string;
  peer?: ApiPeer;
};

const ChatReportPane: FC<OwnProps & StateProps> = ({
  chatId,
  className,
  isAutoArchived,
  canReportSpam,
  canAddContact,
  canBlockContact,
  peer,
  currentUserId,
  onPaneStateChange,
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
    hideChatReportPane,
  } = getActions();

  const lang = useOldLang();
  const [isBlockUserModalOpen, openBlockUserModal, closeBlockUserModal] = useFlag();
  const [shouldReportSpam, setShouldReportSpam] = useState<boolean>(true);
  const [shouldDeleteChat, setShouldDeleteChat] = useState<boolean>(true);

  const renderingPeer = useCurrentOrPrev(peer);
  const chat = renderingPeer && isApiPeerChat(renderingPeer) ? renderingPeer : undefined;
  const user = renderingPeer && isApiPeerUser(renderingPeer) ? renderingPeer : undefined;
  const isBasicGroup = chat && isChatBasicGroup(chat);

  const renderingCanAddContact = useCurrentOrPrev(canAddContact);
  const renderingCanBlockContact = useCurrentOrPrev(canBlockContact);
  const renderingCanReportSpam = useCurrentOrPrev(canReportSpam);
  const renderingIsAutoArchived = useCurrentOrPrev(isAutoArchived);

  const handleAddContact = useLastCallback(() => {
    openAddContactDialog({ userId: chatId });
    if (renderingIsAutoArchived) {
      toggleChatArchived({ id: chatId });
    }
  });

  const handleConfirmBlock = useLastCallback(() => {
    closeBlockUserModal();
    blockUser({ userId: chatId });
    if (renderingCanReportSpam && shouldReportSpam) {
      reportSpam({ chatId });
    }
    if (shouldDeleteChat) {
      deleteChat({ chatId });
    }
  });

  const handleCloseReportPane = useLastCallback(() => {
    hideChatReportPane({ chatId });
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

  const hasAnyButton = canAddContact || canBlockContact || canReportSpam;

  const isRendering = Boolean(hasAnyButton && peer);

  useEffect(() => {
    if (!isRendering) {
      closeBlockUserModal();
    }
  }, [isRendering]);

  const { ref, shouldRender } = useHeaderPane({
    isOpen: isRendering,
    onStateChange: onPaneStateChange,
  });

  if (!shouldRender) return undefined;

  return (
    <div
      ref={ref}
      className={buildClassName('ChatReportPane', className)}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {renderingCanAddContact && (
        <Button
          isText
          fluid
          size="tiny"
          className="ChatReportPane--Button"
          onClick={handleAddContact}
        >
          {lang('lng_new_contact_add')}
        </Button>
      )}
      {renderingCanBlockContact && (
        <Button
          color="danger"
          isText
          fluid
          size="tiny"
          className="ChatReportPane--Button"
          onClick={openBlockUserModal}
        >
          {lang('lng_new_contact_block')}
        </Button>
      )}
      {renderingCanReportSpam && !renderingCanBlockContact && (
        <Button
          color="danger"
          isText
          fluid
          size="tiny"
          className="ChatReportPane--Button"
          onClick={openBlockUserModal}
        >
          {lang('lng_report_spam_and_leave')}
        </Button>
      )}
      <Button
        round
        ripple
        size="smaller"
        color="translucent"
        onClick={handleCloseReportPane}
        ariaLabel={lang('Close')}
      >
        <Icon name="close" />
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
            className="dialog-checkbox"
            label={lang('DeleteThisChat')}
            checked={shouldDeleteChat}
            onCheck={setShouldDeleteChat}
          />
        )}
        {user && canReportSpam && (
          <Checkbox
            className="ChatReportPane--Checkbox dialog-checkbox"
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
    peer: selectPeer(global, chatId),
  }),
)(ChatReportPane));
