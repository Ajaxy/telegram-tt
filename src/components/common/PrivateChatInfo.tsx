import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChatMember, ApiTypingStatus, ApiUser, ApiUserStatus,
} from '../../api/types';
import type { StoryViewerOrigin } from '../../types';
import type { IconName } from '../../types/icons';
import { MediaViewerOrigin } from '../../types';

import { getMainUsername, getUserStatus, isUserOnline } from '../../global/helpers';
import { selectChatMessages, selectUser, selectUserStatus } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import RippleEffect from '../ui/RippleEffect';
import Avatar from './Avatar';
import DotAnimation from './DotAnimation';
import FullNameTitle from './FullNameTitle';
import Icon from './Icon';
import TypingStatus from './TypingStatus';

type OwnProps = {
  userId: string;
  typingStatus?: ApiTypingStatus;
  avatarSize?: 'tiny' | 'small' | 'medium' | 'large' | 'jumbo';
  forceShowSelf?: boolean;
  status?: string;
  statusIcon?: IconName;
  ripple?: boolean;
  withDots?: boolean;
  withMediaViewer?: boolean;
  withUsername?: boolean;
  withStory?: boolean;
  withFullInfo?: boolean;
  withUpdatingStatus?: boolean;
  storyViewerOrigin?: StoryViewerOrigin;
  noEmojiStatus?: boolean;
  emojiStatusSize?: number;
  noStatusOrTyping?: boolean;
  noRtl?: boolean;
  adminMember?: ApiChatMember;
  isSavedDialog?: boolean;
  className?: string;
  onEmojiStatusClick?: NoneToVoidFunction;
};

type StateProps =
  {
    user?: ApiUser;
    userStatus?: ApiUserStatus;
    self?: ApiUser;
    isSavedMessages?: boolean;
    areMessagesLoaded: boolean;
  };

const PrivateChatInfo: FC<OwnProps & StateProps> = ({
  typingStatus,
  avatarSize = 'medium',
  status,
  statusIcon,
  withDots,
  withMediaViewer,
  withUsername,
  withStory,
  withFullInfo,
  withUpdatingStatus,
  emojiStatusSize,
  noStatusOrTyping,
  noEmojiStatus,
  noRtl,
  user,
  userStatus,
  self,
  isSavedMessages,
  isSavedDialog,
  areMessagesLoaded,
  adminMember,
  ripple,
  className,
  storyViewerOrigin,
  onEmojiStatusClick,
}) => {
  const {
    loadFullUser,
    openMediaViewer,
    loadProfilePhotos,
  } = getActions();

  const lang = useLang();

  const { id: userId } = user || {};

  useEffect(() => {
    if (userId) {
      if (withFullInfo) loadFullUser({ userId });
      if (withMediaViewer) loadProfilePhotos({ profileId: userId });
    }
  }, [userId, withFullInfo, withMediaViewer]);

  const handleAvatarViewerOpen = useLastCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, hasMedia: boolean) => {
      if (user && hasMedia) {
        e.stopPropagation();
        openMediaViewer({
          avatarOwnerId: user.id,
          mediaId: 0,
          origin: avatarSize === 'jumbo' ? MediaViewerOrigin.ProfileAvatar : MediaViewerOrigin.MiddleHeaderAvatar,
        });
      }
    },
  );

  const mainUsername = useMemo(() => user && withUsername && getMainUsername(user), [user, withUsername]);

  if (!user) {
    return undefined;
  }

  function renderStatusOrTyping() {
    if (status) {
      return withDots ? (
        <DotAnimation className="status" content={status} />
      ) : (
        <span className="status" dir="auto">
          {statusIcon && <Icon className="status-icon" name={statusIcon} />}
          {renderText(status)}
        </span>
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

    const translatedStatus = getUserStatus(lang, user, userStatus);
    const mainUserNameClassName = buildClassName('handle', translatedStatus && 'withStatus');
    return (
      <span className={buildClassName('status', isUserOnline(user, userStatus, true) && 'online')}>
        {mainUsername && <span className={mainUserNameClassName}>{mainUsername}</span>}
        {translatedStatus && <span className="user-status" dir="auto">{translatedStatus}</span>}
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
            withEmojiStatus={!noEmojiStatus}
            emojiStatusSize={emojiStatusSize}
            isSavedMessages={isSavedMessages}
            isSavedDialog={isSavedDialog}
            onEmojiStatusClick={onEmojiStatusClick}
          />
          {customTitle && <span className="custom-title">{customTitle}</span>}
        </div>
      );
    }

    return (
      <FullNameTitle
        peer={user!}
        withEmojiStatus={!noEmojiStatus}
        emojiStatusSize={emojiStatusSize}
        isSavedMessages={isSavedMessages}
        isSavedDialog={isSavedDialog}
        onEmojiStatusClick={onEmojiStatusClick}
      />
    );
  }

  return (
    <div className={buildClassName('ChatInfo', className)} dir={!noRtl && lang.isRtl ? 'rtl' : undefined}>
      {isSavedDialog && self && (
        <Avatar
          key="saved-messages"
          size={avatarSize}
          peer={self}
          isSavedMessages
          className="saved-dialog-avatar"
        />
      )}
      <Avatar
        key={user.id}
        size={avatarSize}
        peer={user}
        className={buildClassName(isSavedDialog && 'overlay-avatar')}
        isSavedMessages={isSavedMessages}
        isSavedDialog={isSavedDialog}
        withStory={withStory}
        storyViewerOrigin={storyViewerOrigin}
        storyViewerMode="single-peer"
        onClick={withMediaViewer ? handleAvatarViewerOpen : undefined}
      />
      <div className="info">
        {renderNameTitle()}
        {(status || (!isSavedMessages && !noStatusOrTyping)) && renderStatusOrTyping()}
      </div>
      {ripple && <RippleEffect />}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId, forceShowSelf }): StateProps => {
    const user = selectUser(global, userId);
    const userStatus = selectUserStatus(global, userId);
    const isSavedMessages = !forceShowSelf && user && user.isSelf;
    const self = isSavedMessages ? user : selectUser(global, global.currentUserId!);
    const areMessagesLoaded = Boolean(selectChatMessages(global, userId));

    return {
      user,
      userStatus,
      isSavedMessages,
      areMessagesLoaded,
      self,
    };
  },
)(PrivateChatInfo));
