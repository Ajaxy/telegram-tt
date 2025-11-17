import { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChatMember, ApiTopic, ApiTypingStatus, ApiUser, ApiUserStatus,
} from '../../api/types';
import type { CustomPeer, StoryViewerOrigin, ThreadId } from '../../types';
import type { IconName } from '../../types/icons';
import { MediaViewerOrigin } from '../../types';

import {
  getMainUsername, getUserStatus, isSystemBot, isUserOnline,
} from '../../global/helpers';
import {
  selectChatMessages,
  selectThreadMessagesCount,
  selectTopic,
  selectUser,
  selectUserStatus,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import useIntervalForceUpdate from '../../hooks/schedulers/useIntervalForceUpdate';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import RippleEffect from '../ui/RippleEffect';
import Transition from '../ui/Transition';
import Avatar from './Avatar';
import DotAnimation from './DotAnimation';
import FullNameTitle from './FullNameTitle';
import Icon from './icons/Icon';
import TopicIcon from './TopicIcon';
import TypingStatus from './TypingStatus';

const TOPIC_ICON_SIZE = 2.5 * REM;

type BaseOwnProps = {
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
  noFake?: boolean;
  noVerified?: boolean;
  emojiStatusSize?: number;
  noStatusOrTyping?: boolean;
  noRtl?: boolean;
  adminMember?: ApiChatMember;
  isSavedDialog?: boolean;
  noAvatar?: boolean;
  className?: string;
  iconElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  onClick?: VoidFunction;
  onEmojiStatusClick?: VoidFunction;
};

type OwnProps = BaseOwnProps & ({
  userId: string;
  threadId?: ThreadId;
  customPeer?: never;
} | {
  userId?: never;
  threadId?: never;
  customPeer: CustomPeer;
});

type StateProps = {
  user?: ApiUser;
  userStatus?: ApiUserStatus;
  self?: ApiUser;
  isSavedMessages?: boolean;
  areMessagesLoaded: boolean;
  isSynced?: boolean;
  topic?: ApiTopic;
  messagesCount?: number;
};

const UPDATE_INTERVAL = 1000 * 60; // 1 min

const PrivateChatInfo = ({
  userId,
  customPeer,
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
  noFake,
  noVerified,
  noRtl,
  user,
  userStatus,
  self,
  topic,
  messagesCount,
  isSavedMessages,
  isSavedDialog,
  areMessagesLoaded,
  adminMember,
  ripple,
  className,
  storyViewerOrigin,
  noAvatar,
  isSynced,
  iconElement,
  rightElement,
  onClick,
  onEmojiStatusClick,
}: OwnProps & StateProps) => {
  const {
    loadFullUser,
    openMediaViewer,
    loadMoreProfilePhotos,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  const isTopic = Boolean(user?.isBotForum && topic);
  const hasAvatarMediaViewer = withMediaViewer && !isSavedMessages;

  useEffect(() => {
    if (userId) {
      if (withFullInfo && isSynced) loadFullUser({ userId });
      if (withMediaViewer) loadMoreProfilePhotos({ peerId: userId, isPreload: true });
    }
  }, [userId, withFullInfo, withMediaViewer, isSynced]);

  useIntervalForceUpdate(UPDATE_INTERVAL);

  const handleAvatarViewerOpen = useLastCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, hasMedia: boolean) => {
      if (hasMedia) {
        e.stopPropagation();
        openMediaViewer({
          isAvatarView: true,
          chatId: userId,
          mediaIndex: 0,
          origin: avatarSize === 'jumbo' ? MediaViewerOrigin.ProfileAvatar : MediaViewerOrigin.MiddleHeaderAvatar,
        });
      }
    },
  );

  const mainUsername = useMemo(() => user && withUsername && getMainUsername(user), [user, withUsername]);

  if (!user && !customPeer) {
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
        <DotAnimation className="status" content={oldLang('Updating')} />
      );
    }

    if (customPeer?.subtitleKey) {
      return (
        <span className="status" dir="auto">
          <span className="user-status" dir="auto">{oldLang(customPeer.subtitleKey)}</span>
        </span>
      );
    }

    if (!user) {
      return undefined;
    }

    if (typingStatus) {
      return <TypingStatus typingStatus={typingStatus} />;
    }

    if (isTopic) {
      return (
        <span className="status" dir="auto">
          <Transition
            name="fade"
            shouldRestoreHeight
            activeKey={messagesCount !== undefined ? 1 : 2}
            className="message-count-transition"
          >
            {messagesCount !== undefined ? oldLang('messages', messagesCount, 'i') : oldLang('lng_forum_no_messages')}
          </Transition>
        </span>
      );
    }

    if (isSystemBot(user.id)) {
      return undefined;
    }

    const translatedStatus = getUserStatus(oldLang, user, userStatus);
    const mainUserNameClassName = buildClassName('handle', translatedStatus && 'withStatus');
    return (
      <span className={buildClassName('status', isUserOnline(user, userStatus, true) && 'online')}>
        {mainUsername && <span className={mainUserNameClassName}>{mainUsername}</span>}
        {translatedStatus && <span className="user-status" dir="auto">{translatedStatus}</span>}
      </span>
    );
  }

  const customTitle = adminMember
    ? adminMember.customTitle || oldLang(adminMember.isOwner ? 'GroupInfo.LabelOwner' : 'GroupInfo.LabelAdmin')
    : undefined;

  function renderNameTitle() {
    if (isTopic) {
      return (
        <h3 dir="auto" className="fullName">{renderText(topic!.title)}</h3>
      );
    }

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
        peer={customPeer || user!}
        noFake={noFake}
        noVerified={noVerified}
        withEmojiStatus={!noEmojiStatus}
        emojiStatusSize={emojiStatusSize}
        isSavedMessages={isSavedMessages}
        isSavedDialog={isSavedDialog}
        onEmojiStatusClick={onEmojiStatusClick}
        iconElement={iconElement}
      />
    );
  }

  return (
    <div
      className={buildClassName('ChatInfo', className)}
      dir={!noRtl && lang.isRtl ? 'rtl' : undefined}
      onClick={onClick}
    >
      {isSavedDialog && self && (
        <Avatar
          key="saved-messages"
          size={avatarSize}
          peer={self}
          isSavedMessages
          className="saved-dialog-avatar"
        />
      )}
      {!noAvatar && !isTopic && (
        <Avatar
          key={user?.id}
          size={avatarSize}
          peer={customPeer || user}
          className={buildClassName(isSavedDialog && 'overlay-avatar')}
          isSavedMessages={isSavedMessages}
          isSavedDialog={isSavedDialog}
          withStory={withStory}
          storyViewerOrigin={storyViewerOrigin}
          storyViewerMode="single-peer"
          onClick={hasAvatarMediaViewer ? handleAvatarViewerOpen : undefined}
        />
      )}
      {isTopic && (
        <TopicIcon
          topic={topic!}
          className="topic-header-icon"
          size={TOPIC_ICON_SIZE}
        />
      )}
      <div className="info">
        {renderNameTitle()}
        {(status || (!isSavedMessages && !noStatusOrTyping)) && renderStatusOrTyping()}
      </div>
      {ripple && <RippleEffect />}
      {rightElement}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId, threadId, forceShowSelf }): Complete<StateProps> => {
    const { isSynced } = global;
    const user = userId ? selectUser(global, userId) : undefined;
    const userStatus = userId ? selectUserStatus(global, userId) : undefined;
    const isSavedMessages = !forceShowSelf && user && user.isSelf;
    const self = isSavedMessages ? user : selectUser(global, global.currentUserId!);
    const areMessagesLoaded = Boolean(userId ? selectChatMessages(global, userId) : undefined);

    const topic = threadId ? selectTopic(global, userId, threadId) : undefined;
    const messagesCount = topic && userId ? selectThreadMessagesCount(global, userId, threadId!) : undefined;

    return {
      user,
      userStatus,
      isSavedMessages,
      areMessagesLoaded,
      self,
      isSynced,
      topic,
      messagesCount,
    };
  },
)(PrivateChatInfo));
