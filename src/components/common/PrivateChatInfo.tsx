import type { MouseEvent as ReactMouseEvent } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { useEffect, useCallback, memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser, ApiTypingStatus, ApiUserStatus } from '../../api/types';
import type { GlobalState } from '../../global/types';
import { MediaViewerOrigin } from '../../types';

import { selectChatMessages, selectUser, selectUserStatus } from '../../global/selectors';
import { getUserFullName, getUserStatus, isUserOnline } from '../../global/helpers';
import renderText from './helpers/renderText';
import useLang from '../../hooks/useLang';

import Avatar from './Avatar';
import VerifiedIcon from './VerifiedIcon';
import TypingStatus from './TypingStatus';
import DotAnimation from './DotAnimation';
import FakeIcon from './FakeIcon';
import PremiumIcon from './PremiumIcon';

type OwnProps = {
  userId: string;
  typingStatus?: ApiTypingStatus;
  avatarSize?: 'tiny' | 'small' | 'medium' | 'large' | 'jumbo';
  forceShowSelf?: boolean;
  status?: string;
  withDots?: boolean;
  withMediaViewer?: boolean;
  withUsername?: boolean;
  withFullInfo?: boolean;
  withUpdatingStatus?: boolean;
  withVideoAvatar?: boolean;
  noStatusOrTyping?: boolean;
  noRtl?: boolean;
};

type StateProps =
  {
    user?: ApiUser;
    userStatus?: ApiUserStatus;
    isSavedMessages?: boolean;
    areMessagesLoaded: boolean;
    serverTimeOffset: number;
  }
  & Pick<GlobalState, 'lastSyncTime'>;

const PrivateChatInfo: FC<OwnProps & StateProps> = ({
  typingStatus,
  avatarSize = 'medium',
  status,
  withDots,
  withMediaViewer,
  withUsername,
  withFullInfo,
  withUpdatingStatus,
  withVideoAvatar,
  noStatusOrTyping,
  noRtl,
  user,
  userStatus,
  isSavedMessages,
  areMessagesLoaded,
  lastSyncTime,
  serverTimeOffset,
}) => {
  const {
    loadFullUser,
    openMediaViewer,
  } = getActions();

  const { id: userId } = user || {};
  const fullName = getUserFullName(user);

  useEffect(() => {
    if (withFullInfo && lastSyncTime && userId) {
      loadFullUser({ userId });
    }
  }, [userId, loadFullUser, lastSyncTime, withFullInfo]);

  const handleAvatarViewerOpen = useCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>, hasMedia: boolean) => {
    if (user && hasMedia) {
      e.stopPropagation();
      openMediaViewer({
        avatarOwnerId: user.id,
        origin: avatarSize === 'jumbo' ? MediaViewerOrigin.ProfileAvatar : MediaViewerOrigin.MiddleHeaderAvatar,
      });
    }
  }, [user, avatarSize, openMediaViewer]);

  const lang = useLang();

  if (!user) {
    return undefined;
  }

  function renderStatusOrTyping() {
    if (status) {
      return withDots ? (
        <DotAnimation className="status" content={status} />
      ) : (
        <span className="status" dir="auto">{status}</span>
      );
    }

    if (withUpdatingStatus && !areMessagesLoaded) {
      return (
        <DotAnimation className="status" content={lang('Updating')} />
      );
    }

    if (!user) {
      return undefined;
    }

    if (typingStatus) {
      return <TypingStatus typingStatus={typingStatus} />;
    }

    return (
      <span className={`status ${isUserOnline(user, userStatus) ? 'online' : ''}`}>
        {withUsername && user.username && <span className="handle">{user.username}</span>}
        <span className="user-status" dir="auto">{getUserStatus(lang, user, userStatus, serverTimeOffset)}</span>
      </span>
    );
  }

  return (
    <div className="ChatInfo" dir={!noRtl && lang.isRtl ? 'rtl' : undefined}>
      <Avatar
        key={user.id}
        size={avatarSize}
        user={user}
        isSavedMessages={isSavedMessages}
        onClick={withMediaViewer ? handleAvatarViewerOpen : undefined}
        noVideo={!withVideoAvatar}
      />
      <div className="info">
        {isSavedMessages ? (
          <div className="title">
            <h3>{lang('SavedMessages')}</h3>
          </div>
        ) : (
          <div className="title">
            <h3 dir="auto">{fullName && renderText(fullName)}</h3>
            {user?.isVerified && <VerifiedIcon />}
            {user.isPremium && <PremiumIcon />}
            {user.fakeType && <FakeIcon fakeType={user.fakeType} />}
          </div>
        )}
        {(status || (!isSavedMessages && !noStatusOrTyping)) && renderStatusOrTyping()}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId, forceShowSelf }): StateProps => {
    const { lastSyncTime, serverTimeOffset } = global;
    const user = selectUser(global, userId);
    const userStatus = selectUserStatus(global, userId);
    const isSavedMessages = !forceShowSelf && user && user.isSelf;
    const areMessagesLoaded = Boolean(selectChatMessages(global, userId));

    return {
      lastSyncTime, user, userStatus, isSavedMessages, areMessagesLoaded, serverTimeOffset,
    };
  },
)(PrivateChatInfo));
