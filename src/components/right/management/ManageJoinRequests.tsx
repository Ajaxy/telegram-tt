import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat } from '../../../api/types';

import { STICKER_SIZE_JOIN_REQUESTS } from '../../../config';
import { isChatChannel, isUserId } from '../../../global/helpers';
import { selectChat } from '../../../global/selectors';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Spinner from '../../ui/Spinner';
import JoinRequest from './JoinRequest';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  isChannel?: boolean;
};

const ManageJoinRequests: FC<OwnProps & StateProps> = ({
  chat,
  chatId,
  isActive,
  isChannel,
  onClose,
}) => {
  const { hideAllChatJoinRequests, loadChatJoinRequests } = getActions();
  const [isAcceptAllDialogOpen, openAcceptAllDialog, closeAcceptAllDialog] = useFlag();
  const [isRejectAllDialogOpen, openRejectAllDialog, closeRejectAllDialog] = useFlag();

  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useEffect(() => {
    if (!chat?.joinRequests && !isUserId(chatId)) {
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
      <div className="custom-scroll">
        <div className="section">
          <AnimatedIconWithPreview
            tgsUrl={LOCAL_TGS_URLS.JoinRequest}
            size={STICKER_SIZE_JOIN_REQUESTS}
            className="section-icon"
          />
          {Boolean(chat?.joinRequests?.length) && (
            <div className="bulk-actions">
              <Button className="bulk-action-button" onClick={openAcceptAllDialog}>Accept all</Button>
              <Button className="bulk-action-button" onClick={openRejectAllDialog} isText>Dismiss all</Button>
            </div>
          )}
        </div>
        <div className="section" teactFastList>
          <p key="title">
            {!chat?.joinRequests ? lang('Loading') : chat.joinRequests.length
              ? lang('JoinRequests', chat.joinRequests.length) : lang('NoMemberRequests')}
          </p>
          {!chat?.joinRequests && (
            <Spinner key="loading" />
          )}
          {chat?.joinRequests?.length === 0 && (
            <p className="section-help" key="empty">
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
      isChannel: chat && isChatChannel(chat),
    };
  },
)(ManageJoinRequests));
