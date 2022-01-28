import React, {
  FC, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiChat } from '../../../api/types';

import useHistoryBack from '../../../hooks/useHistoryBack';
import { selectChat } from '../../../modules/selectors';
import { isChatChannel } from '../../../modules/helpers';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';

import JoinRequest from './JoinRequest';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  isChannel?: boolean;
  serverTimeOffset: number;
};

const ManageJoinRequests: FC<OwnProps & StateProps> = ({
  chat,
  chatId,
  isActive,
  isChannel,
  onClose,
}) => {
  const { hideAllChatJoinRequests, loadChatJoinRequests } = getDispatch();
  const [isAcceptAllDialogOpen, openAcceptAllDialog, closeAcceptAllDialog] = useFlag();
  const [isRejectAllDialogOpen, openRejectAllDialog, closeRejectAllDialog] = useFlag();

  const lang = useLang();

  useHistoryBack(isActive, onClose);

  useEffect(() => {
    if (!chat?.joinRequests) {
      loadChatJoinRequests({ chatId });
    }
  }, [chat, chatId, loadChatJoinRequests]);

  const handleAcceptAllRequests = useCallback(() => {
    hideAllChatJoinRequests({ chatId, isApproved: true });
    closeAcceptAllDialog();
  }, [hideAllChatJoinRequests, chatId, closeAcceptAllDialog]);

  const handleRejectAllRequests = useCallback(() => {
    hideAllChatJoinRequests({ chatId, isApproved: false });
    closeRejectAllDialog();
  }, [hideAllChatJoinRequests, chatId, closeRejectAllDialog]);

  return (
    <div className="Management ManageJoinRequests">
      {Boolean(chat?.joinRequests?.length) && (
        <div className="section bulk-actions">
          <Button className="bulk-action-button" onClick={openAcceptAllDialog}>Accept all</Button>
          <Button className="bulk-action-button" onClick={openRejectAllDialog} isText>Dismiss all</Button>
        </div>
      )}
      <div className="section">
        <div className="custom-scroll" teactFastList>
          <p key="title">
            {chat?.joinRequests?.length ? lang('JoinRequests', chat?.joinRequests?.length) : lang('NoMemberRequests')}
          </p>
          {chat?.joinRequests?.length === 0 && (
            <p className="text-muted" key="empty">
              {isChannel ? lang('NoSubscribeRequestsDescription') : lang('NoMemberRequestsDescription')}
            </p>
          )}
          {chat?.joinRequests?.map(({ userId, about, date }) => (
            <JoinRequest
              userId={userId}
              about={about}
              date={date}
              isChannel={isChannel}
              chatId={chatId}
              key={userId}
            />
          ))}
        </div>
      </div>
      <ConfirmDialog
        isOpen={isAcceptAllDialogOpen}
        onClose={closeAcceptAllDialog}
        title="Accept all requests?"
        text="Are you sure you want to accept all requests?"
        confirmHandler={handleAcceptAllRequests}
      />
      <ConfirmDialog
        isOpen={isRejectAllDialogOpen}
        onClose={closeRejectAllDialog}
        title="Reject all requests?"
        text="Are you sure you want to reject all requests?"
        confirmHandler={handleRejectAllRequests}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);

    return {
      chat,
      serverTimeOffset: global.serverTimeOffset,
      isChannel: chat && isChatChannel(chat),
    };
  },
)(ManageJoinRequests));
