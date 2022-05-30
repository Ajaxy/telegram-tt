import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat } from '../../../api/types';

import { STICKER_SIZE_JOIN_REQUESTS } from '../../../config';
import useHistoryBack from '../../../hooks/useHistoryBack';
import { selectChat } from '../../../global/selectors';
import { isChatChannel, isUserId } from '../../../global/helpers';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import getAnimationData from '../../common/helpers/animatedAssets';

import JoinRequest from './JoinRequest';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import AnimatedSticker from '../../common/AnimatedSticker';
import Spinner from '../../ui/Spinner';

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
  const { hideAllChatJoinRequests, loadChatJoinRequests } = getActions();
  const [isAcceptAllDialogOpen, openAcceptAllDialog, closeAcceptAllDialog] = useFlag();
  const [isRejectAllDialogOpen, openRejectAllDialog, closeRejectAllDialog] = useFlag();

  const lang = useLang();

  const [animationData, setAnimationData] = useState<string>();
  const [isAnimationLoaded, setIsAnimationLoaded] = useState(false);
  const handleAnimationLoad = useCallback(() => setIsAnimationLoaded(true), []);

  useEffect(() => {
    if (!animationData) {
      getAnimationData('JoinRequest').then(setAnimationData);
    }
  }, [animationData]);

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
          <div className="section-icon">
            {animationData && (
              <AnimatedSticker
                id="joinRequestDucks"
                size={STICKER_SIZE_JOIN_REQUESTS}
                animationData={animationData}
                play={isAnimationLoaded}
                onLoad={handleAnimationLoad}
              />
            )}
          </div>
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
