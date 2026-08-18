import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';

import {
  getChatTitle, getUserFirstOrLastName, getUserFullName, isChatBasicGroup,
} from '../../../global/helpers';
import { isApiPeerChat, isApiPeerUser } from '../../../global/helpers/peers';
import { selectPeer } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useFrozenProps from '../../../hooks/useFrozenProps';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

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
    leaveChannel,
    deleteChatUser,
    deleteHistory,
    toggleChatArchived,
    hidePeerSettingsBar,
  } = getActions();

  const lang = useOldLang();
  const [isBlockUserModalOpen, openBlockUserModal, closeBlockUserModal] = useFlag();
  const [shouldReportSpam, setShouldReportSpam] = useState<boolean>(true);
  const [shouldDeleteChat, setShouldDeleteChat] = useState<boolean>(true);

  const hasAnyButton = canAddContact || canBlockContact || canReportSpam;
  const isRendering = Boolean(hasAnyButton && peer);

  const {
    chatId: renderingChatId,
    peer: renderingPeer,
    canAddContact: renderingCanAddContact,
    canBlockContact: renderingCanBlockContact,
    canReportSpam: renderingCanReportSpam,
    isAutoArchived: renderingIsAutoArchived,
  } = useFrozenProps({
    chatId, peer, canAddContact, canBlockContact, canReportSpam, isAutoArchived,
  }, !isRendering);
  const chat = renderingPeer && isApiPeerChat(renderingPeer) ? renderingPeer : undefined;
  const user = renderingPeer && isApiPeerUser(renderingPeer) ? renderingPeer : undefined;
  const isBasicGroup = chat && isChatBasicGroup(chat);

  const handleAddContact = useLastCallback(() => {
    openAddContactDialog({ userId: renderingChatId });
    if (renderingIsAutoArchived) {
      toggleChatArchived({ id: renderingChatId });
    }
  });

  const handleConfirmBlock = useLastCallback(() => {
    closeBlockUserModal();
    blockUser({ userId: renderingChatId });
    if (renderingCanReportSpam && shouldReportSpam) {
      reportSpam({ chatId: renderingChatId });
    }
    if (shouldDeleteChat) {
      deleteHistory({ chatId: renderingChatId, shouldDeleteForAll: false });
    }
  });

  const handleCloseReportPane = useLastCallback(() => {
    hidePeerSettingsBar({ peerId: renderingChatId });
  });

  const handleChatReportSpam = useLastCallback(() => {
    closeBlockUserModal();
    reportSpam({ chatId: renderingChatId });
    if (isBasicGroup) {
      deleteChatUser({ chatId: renderingChatId, userId: currentUserId! });
      deleteHistory({ chatId: renderingChatId, shouldDeleteForAll: false });
    } else {
      leaveChannel({ chatId: renderingChatId });
    }
  });

  useEffect(() => {
    closeBlockUserModal();
    setShouldReportSpam(true);
    setShouldDeleteChat(true);
  }, [chatId, isRendering, closeBlockUserModal]);

  const { ref, shouldRender } = useHeaderPane({
    isOpen: isRendering,
    measureKey: chatId,
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
        iconName="close"
      />
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
        {user && renderingCanReportSpam && (
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
  (global, { chatId }): Complete<StateProps> => ({
    currentUserId: global.currentUserId,
    peer: selectPeer(global, chatId),
  }),
)(ChatReportPane));
