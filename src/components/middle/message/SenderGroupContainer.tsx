import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiMessage,
  ApiPeer,
} from '../../../api/types';

import {
  isAnonymousForwardsChat,
  isAnonymousOwnMessage,
  isSystemBot,
} from '../../../global/helpers';
import {
  selectForwardedSender,
  selectIsChatWithSelf,
  selectSender,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';

import styles from './SenderGroupContainer.module.scss';

type OwnProps =
  {
    message: ApiMessage;
    withAvatar?: boolean;
    children: React.ReactNode;
    id: string;
  };

  type StateProps = {
    sender?: ApiPeer;
    canShowSender: boolean;
    originSender?: ApiPeer;
    isChatWithSelf?: boolean;
    isRepliesChat?: boolean;
    isAnonymousForwards?: boolean;
  };

const SenderGroupContainer: FC<OwnProps & StateProps> = ({
  message,
  withAvatar,
  children,
  id,
  sender,
  canShowSender,
  originSender,
  isChatWithSelf,
  isRepliesChat,
  isAnonymousForwards,
}) => {
  const { openChat } = getActions();

  const { forwardInfo } = message;

  const messageSender = canShowSender ? sender : undefined;

  const shouldPreferOriginSender = forwardInfo
  && (isChatWithSelf || isRepliesChat || isAnonymousForwards || !messageSender);
  const avatarPeer = shouldPreferOriginSender ? originSender : messageSender;

  const handleAvatarClick = useLastCallback(() => {
    if (!avatarPeer) {
      return;
    }

    openChat({ id: avatarPeer.id });
  });

  function renderAvatar() {
    const hiddenName = (!avatarPeer && forwardInfo) ? forwardInfo.hiddenUserName : undefined;

    return (
      <Avatar
        size="small"
        className={styles.senderAvatar}
        peer={avatarPeer}
        text={hiddenName}
        onClick={avatarPeer ? handleAvatarClick : undefined}
      />
    );
  }

  const className = buildClassName(
    'sender-group-container',
    styles.root,
  );

  return (
    <div id={id} className={className}>
      {withAvatar && (
        <div className={styles.avatarContainer}>
          {renderAvatar()}
        </div>
      )}
      {children}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, ownProps): StateProps => {
    const {
      message, withAvatar,
    } = ownProps;
    const { chatId } = message;

    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isSystemBotChat = isSystemBot(chatId);
    const isAnonymousForwards = isAnonymousForwardsChat(chatId);

    const forceSenderName = !isChatWithSelf && isAnonymousOwnMessage(message);
    const canShowSender = withAvatar || forceSenderName;
    const sender = selectSender(global, message);
    const originSender = selectForwardedSender(global, message);

    return {
      sender,
      canShowSender,
      originSender,
      isChatWithSelf,
      isRepliesChat: isSystemBotChat,
      isAnonymousForwards,
    };
  },
)(SenderGroupContainer));
