import React, {
  useEffect, useCallback, memo, useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type {
  ApiUser, ApiTypingStatus, ApiUserStatus, ApiChatMember,
} from '../../api/types';
import type { GlobalState } from '../../global/types';
import type { AnimationLevel } from '../../types';
import { MediaViewerOrigin } from '../../types';

import { selectChatMessages, selectUser, selectUserStatus } from '../../global/selectors';
import { getMainUsername, getUserStatus, isUserOnline } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';

import Avatar from './Avatar';
import TypingStatus from './TypingStatus';
import DotAnimation from './DotAnimation';
import FullNameTitle from './FullNameTitle';

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
  emojiStatusSize?: number;
  noStatusOrTyping?: boolean;
  noRtl?: boolean;
  adminMember?: ApiChatMember;
};

type StateProps =
  {
    user?: ApiUser;
    userStatus?: ApiUserStatus;
    isSavedMessages?: boolean;
    animationLevel: AnimationLevel;
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
  emojiStatusSize,
  noStatusOrTyping,
  noRtl,
  user,
  userStatus,
  isSavedMessages,
  areMessagesLoaded,
  animationLevel,
  lastSyncTime,
  serverTimeOffset,
  adminMember,
}) => {
  const {
    loadFullUser,
    openMediaViewer,
    loadProfilePhotos,
  } = getActions();

  const { id: userId } = user || {};

  useEffect(() => {
    if (userId && lastSyncTime) {
      if (withFullInfo) loadFullUser({ userId });
      if (withMediaViewer) loadProfilePhotos({ profileId: userId });
    }
  }, [userId, loadFullUser, loadProfilePhotos, lastSyncTime, withFullInfo, withMediaViewer]);

  const handleAvatarViewerOpen = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>, hasMedia: boolean) => {
    if (user && hasMedia) {
      e.stopPropagation();
      openMediaViewer({
        avatarOwnerId: user.id,
        mediaId: 0,
        origin: avatarSize === 'jumbo' ? MediaViewerOrigin.ProfileAvatar : MediaViewerOrigin.MiddleHeaderAvatar,
      });
    }
  }, [user, avatarSize, openMediaViewer]);

  const lang = useLang();
  const mainUsername = useMemo(() => user && withUsername && getMainUsername(user), [user, withUsername]);

  if (!user) {
    return undefined;
  }

  function renderStatusOrTyping() {
    if (status) {
      return withDots ? (
        <DotAnimation className="status" content={status} />
      ) : (
        <span className="status" dir="auto">{renderText(status)}</span>
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
      <span className={buildClassName('status', isUserOnline(user, userStatus) && 'online')}>
        {mainUsername && <span className="handle">{mainUsername}</span>}
        <span className="user-status" dir="auto">{getUserStatus(lang, user, userStatus, serverTimeOffset)}</span>
      </span>
    );
  }

  const customTitle = adminMember
    ? adminMember.customTitle || lang(adminMember.isOwner ? 'GroupInfo.LabelOwner' : 'GroupInfo.LabelAdmin')
    : undefined;

  function renderNameTitle() {
    if (customTitle) {
      return (
        <div className="info-name-title">
          <FullNameTitle
            peer={user!}
            withEmojiStatus
            emojiStatusSize={emojiStatusSize}
            isSavedMessages={isSavedMessages}
          />
          {customTitle && <span className="custom-title">{customTitle}</span>}
        </div>
      );
    }

    return (
      <FullNameTitle
        peer={user!}
        withEmojiStatus
        emojiStatusSize={emojiStatusSize}
        isSavedMessages={isSavedMessages}
      />
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
        withVideo={withVideoAvatar}
        animationLevel={animationLevel}
      />
      <div className="info">
        {renderNameTitle()}
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
      lastSyncTime,
      user,
      userStatus,
      isSavedMessages,
      areMessagesLoaded,
      serverTimeOffset,
      animationLevel: global.settings.byKey.animationLevel,
    };
  },
)(PrivateChatInfo));
