import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useEffect,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiMessage,
  ApiPeer,
} from '../../../api/types';

import { MESSAGE_APPEARANCE_DELAY } from '../../../config';
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

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';

import Avatar from '../../common/Avatar';

import styles from './SenderGroupContainer.module.scss';

type OwnProps =
  {
    message: ApiMessage;
    withAvatar?: boolean;
    children: React.ReactNode;
    id: string;
    appearanceOrder: number;
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
  appearanceOrder,
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

  const noAppearanceAnimation = appearanceOrder <= 0;
  const [isShown, markShown] = useFlag(noAppearanceAnimation);
  useEffect(() => {
    if (noAppearanceAnimation) {
      return;
    }

    setTimeout(markShown, appearanceOrder * MESSAGE_APPEARANCE_DELAY);
  }, [appearanceOrder, markShown, noAppearanceAnimation]);

  const shouldPreferOriginSender = forwardInfo
  && (isChatWithSelf || isRepliesChat || isAnonymousForwards || !messageSender);
  const avatarPeer = shouldPreferOriginSender ? originSender : messageSender;

  const handleAvatarClick = useLastCallback(() => {
    if (!avatarPeer) {
      return;
    }

    openChat({ id: avatarPeer.id });
  });

  const {
    ref: avatarRef,
    shouldRender,
  } = useShowTransition({
    isOpen: withAvatar && isShown,
    withShouldRender: true,
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
      {shouldRender && (
        <div ref={avatarRef} className={styles.avatarContainer}>
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
