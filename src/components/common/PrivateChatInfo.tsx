import { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  FC, useEffect, useCallback, memo,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiUser, ApiTypingStatus, ApiUserStatus } from '../../api/types';
import { GlobalActions, GlobalState } from '../../global/types';
import { MediaViewerOrigin } from '../../types';

import { selectChatMessages, selectUser, selectUserStatus } from '../../modules/selectors';
import { getUserFullName, getUserStatus, isUserOnline } from '../../modules/helpers';
import renderText from './helpers/renderText';
import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import Avatar from './Avatar';
import VerifiedIcon from './VerifiedIcon';
import TypingStatus from './TypingStatus';

type OwnProps = {
  userId: string;
  typingStatus?: ApiTypingStatus;
  avatarSize?: 'tiny' | 'small' | 'medium' | 'large' | 'jumbo';
  forceShowSelf?: boolean;
  status?: string;
  withMediaViewer?: boolean;
  withUsername?: boolean;
  withFullInfo?: boolean;
  withUpdatingStatus?: boolean;
  noStatusOrTyping?: boolean;
  noRtl?: boolean;
};

type StateProps = {
  user?: ApiUser;
  userStatus?: ApiUserStatus;
  isSavedMessages?: boolean;
  areMessagesLoaded: boolean;
  serverTimeOffset: number;
} & Pick<GlobalState, 'lastSyncTime'>;

type DispatchProps = Pick<GlobalActions, 'loadFullUser' | 'openMediaViewer'>;

const PrivateChatInfo: FC<OwnProps & StateProps & DispatchProps> = ({
  typingStatus,
  avatarSize = 'medium',
  status,
  withMediaViewer,
  withUsername,
  withFullInfo,
  withUpdatingStatus,
  noStatusOrTyping,
  noRtl,
  user,
  userStatus,
  isSavedMessages,
  areMessagesLoaded,
  lastSyncTime,
  serverTimeOffset,
  loadFullUser,
  openMediaViewer,
}) => {
  const { id: userId } = user || {};
  const fullName = getUserFullName(user);

  useEffect(() => {
    if (withFullInfo && lastSyncTime && userId) {
      loadFullUser({ userId });
    }
  }, [userId, loadFullUser, lastSyncTime, withFullInfo]);

  const handleAvatarViewerOpen = useCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>, hasPhoto: boolean) => {
    if (user && hasPhoto) {
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
      return (
        <span className="status" dir="auto">{status}</span>
      );
    }

    if (withUpdatingStatus && !areMessagesLoaded) {
      return (
        <span className="status" dir="auto">{lang('Updating')}</span>
      );
    }

    if (!user) {
      return undefined;
    }

    if (typingStatus) {
      return <TypingStatus typingStatus={typingStatus} />;
    }

    return (
      <div className={`status ${isUserOnline(user, userStatus) ? 'online' : ''}`}>
        {withUsername && user.username && <span className="handle">{user.username}</span>}
        <span className="user-status" dir="auto">{getUserStatus(lang, user, userStatus, serverTimeOffset)}</span>
      </div>
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
  (setGlobal, actions): DispatchProps => pick(actions, ['loadFullUser', 'openMediaViewer']),
)(PrivateChatInfo));
