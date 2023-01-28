import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect, useCallback, memo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiUser, ApiChat, ApiUserStatus, ApiTopic,
} from '../../api/types';
import type { GlobalState } from '../../global/types';
import type { AnimationLevel } from '../../types';
import { MediaViewerOrigin } from '../../types';

import { IS_TOUCH_ENV } from '../../util/environment';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import {
  selectTabState,
  selectChat, selectCurrentMessageList, selectThreadMessagesCount, selectUser, selectUserStatus,
} from '../../global/selectors';
import { getUserStatus, isChatChannel, isUserOnline } from '../../global/helpers';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import usePhotosPreload from './hooks/usePhotosPreload';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';

import FullNameTitle from './FullNameTitle';
import ProfilePhoto from './ProfilePhoto';
import Transition from '../ui/Transition';
import TopicIcon from './TopicIcon';
import Avatar from './Avatar';

import './ProfileInfo.scss';
import styles from './ProfileInfo.module.scss';

type OwnProps = {
  userId: string;
  forceShowSelf?: boolean;
  canPlayVideo: boolean;
};

type StateProps =
  {
    user?: ApiUser;
    userStatus?: ApiUserStatus;
    chat?: ApiChat;
    isSavedMessages?: boolean;
    animationLevel: AnimationLevel;
    mediaId?: number;
    avatarOwnerId?: string;
    topic?: ApiTopic;
    messagesCount?: number;
  }
  & Pick<GlobalState, 'connectionState'>;

const EMOJI_STATUS_SIZE = 24;
const EMOJI_TOPIC_SIZE = 120;

const ProfileInfo: FC<OwnProps & StateProps> = ({
  forceShowSelf,
  canPlayVideo,
  user,
  userStatus,
  chat,
  isSavedMessages,
  connectionState,
  animationLevel,
  mediaId,
  avatarOwnerId,
  topic,
  messagesCount,
}) => {
  const {
    loadFullUser,
    openMediaViewer,
    openPremiumModal,
  } = getActions();

  const lang = useLang();

  const { id: userId } = user || {};
  const { id: chatId } = chat || {};
  const photos = user?.photos || chat?.photos || MEMO_EMPTY_ARRAY;
  const prevMediaId = usePrevious(mediaId);
  const prevAvatarOwnerId = usePrevious(avatarOwnerId);
  const [hasSlideAnimation, setHasSlideAnimation] = useState(true);
  const slideAnimation = hasSlideAnimation
    ? animationLevel >= 1 ? (lang.isRtl ? 'slide-optimized-rtl' : 'slide-optimized') : 'none'
    : 'none';

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const isFirst = isSavedMessages || photos.length <= 1 || currentPhotoIndex === 0;
  const isLast = isSavedMessages || photos.length <= 1 || currentPhotoIndex === photos.length - 1;

  // Set the current avatar photo to the last selected photo in Media Viewer after it is closed
  useEffect(() => {
    if (prevAvatarOwnerId && prevMediaId !== undefined && mediaId === undefined) {
      setHasSlideAnimation(false);
      setCurrentPhotoIndex(prevMediaId);
    }
  }, [mediaId, prevMediaId, prevAvatarOwnerId]);

  // Deleting the last profile photo may result in an error
  useEffect(() => {
    if (currentPhotoIndex > photos.length) {
      setCurrentPhotoIndex(Math.max(0, photos.length - 1));
    }
  }, [currentPhotoIndex, photos.length]);

  useEffect(() => {
    if (connectionState === 'connectionStateReady' && userId && !forceShowSelf) {
      loadFullUser({ userId });
    }
  }, [userId, loadFullUser, connectionState, forceShowSelf]);

  usePhotosPreload(user || chat, photos, currentPhotoIndex);

  const handleProfilePhotoClick = useCallback(() => {
    openMediaViewer({
      avatarOwnerId: userId || chatId,
      mediaId: currentPhotoIndex,
      origin: forceShowSelf ? MediaViewerOrigin.SettingsAvatar : MediaViewerOrigin.ProfileAvatar,
    });
  }, [openMediaViewer, userId, chatId, currentPhotoIndex, forceShowSelf]);

  const handleClickPremium = useCallback(() => {
    if (!user) return;

    openPremiumModal({ fromUserId: user.id });
  }, [openPremiumModal, user]);

  const selectPreviousMedia = useCallback(() => {
    if (isFirst) {
      return;
    }
    setHasSlideAnimation(true);
    setCurrentPhotoIndex(currentPhotoIndex - 1);
  }, [currentPhotoIndex, isFirst]);

  const selectNextMedia = useCallback(() => {
    if (isLast) {
      return;
    }
    setHasSlideAnimation(true);
    setCurrentPhotoIndex(currentPhotoIndex + 1);
  }, [currentPhotoIndex, isLast]);

  function handleSelectFallbackPhoto() {
    if (!isFirst) return;
    setHasSlideAnimation(true);
    setCurrentPhotoIndex(photos.length - 1);
  }

  // Swipe gestures
  useEffect(() => {
    const element = document.querySelector<HTMLDivElement>(`.${styles.photoWrapper}`);
    if (!element) {
      return undefined;
    }

    return captureEvents(element, {
      selectorToPreventScroll: '.Profile, .settings-content',
      onSwipe: IS_TOUCH_ENV ? (e, direction) => {
        if (direction === SwipeDirection.Right) {
          selectPreviousMedia();
          return true;
        } else if (direction === SwipeDirection.Left) {
          selectNextMedia();
          return true;
        }

        return false;
      } : undefined,
    });
  }, [selectNextMedia, selectPreviousMedia]);

  if (!user && !chat) {
    return undefined;
  }

  function renderTopic() {
    return (
      <div className={styles.topicContainer}>
        <TopicIcon
          topic={topic!}
          size={EMOJI_TOPIC_SIZE}
          className={styles.topicIcon}
          letterClassName={styles.topicIconTitle}
          noLoopLimit
        />
        <h3 className={styles.topicTitle} dir={lang.isRtl ? 'rtl' : undefined}>{renderText(topic!.title)}</h3>
        <p className={styles.topicMessagesCounter}>
          {messagesCount ? lang('Chat.Title.Topic', messagesCount, 'i') : lang('lng_forum_no_messages')}
        </p>
      </div>
    );
  }

  function renderPhotoTabs() {
    if (isSavedMessages || !photos || photos.length <= 1) {
      return undefined;
    }

    return (
      <div className={styles.photoDashes}>
        {photos.map((_, i) => (
          <span className={buildClassName(styles.photoDash, i === currentPhotoIndex && styles.photoDash_current)} />
        ))}
      </div>
    );
  }

  function renderPhoto(isActive?: boolean) {
    const photo = !isSavedMessages && photos.length > 0
      ? photos[currentPhotoIndex]
      : undefined;
    return (
      <ProfilePhoto
        key={currentPhotoIndex}
        user={user}
        chat={chat}
        photo={photo}
        isSavedMessages={isSavedMessages}
        canPlayVideo={Boolean(isActive && canPlayVideo)}
        onClick={handleProfilePhotoClick}
      />
    );
  }

  function renderStatus() {
    if (user) {
      return (
        <div className={buildClassName(styles.status, 'status', isUserOnline(user, userStatus) && 'online')}>
          <span className="user-status" dir="auto">{getUserStatus(lang, user, userStatus)}</span>
        </div>
      );
    }

    return (
      <span className={buildClassName(styles.status, 'status')} dir="auto">{
        isChatChannel(chat!)
          ? lang('Subscribers', chat!.membersCount ?? 0, 'i')
          : lang('Members', chat!.membersCount ?? 0, 'i')
      }
      </span>
    );
  }

  if (topic) {
    return renderTopic();
  }

  return (
    <div
      className={buildClassName('ProfileInfo', forceShowSelf && styles.self)}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      <div className={styles.photoWrapper}>
        {renderPhotoTabs()}
        {!forceShowSelf && user?.fullInfo?.personalPhoto && (
          <div className={buildClassName(
            styles.fallbackPhoto,
            isFirst && styles.fallbackPhotoVisible,
          )}
          >
            <div className={styles.fallbackPhotoContents}>
              {lang(user.fullInfo.personalPhoto.isVideo ? 'UserInfo.CustomVideo' : 'UserInfo.CustomPhoto')}
            </div>
          </div>
        )}
        {forceShowSelf && user?.fullInfo?.fallbackPhoto && (
          <div className={buildClassName(
            styles.fallbackPhoto,
            (isFirst || isLast) && styles.fallbackPhotoVisible,
          )}
          >
            <div className={styles.fallbackPhotoContents} onClick={handleSelectFallbackPhoto}>
              {!isLast && (
                <Avatar
                  photo={user.fullInfo.fallbackPhoto}
                  className={styles.fallbackPhotoAvatar}
                  size="mini"
                />
              )}
              {lang(user.fullInfo.fallbackPhoto.isVideo ? 'UserInfo.PublicVideo' : 'UserInfo.PublicPhoto')}
            </div>
          </div>
        )}
        <Transition activeKey={currentPhotoIndex} name={slideAnimation}>
          {renderPhoto}
        </Transition>

        {!isFirst && (
          <button
            type="button"
            dir={lang.isRtl ? 'rtl' : undefined}
            className={buildClassName(styles.navigation, styles.navigation_prev)}
            aria-label={lang('AccDescrPrevious')}
            onClick={selectPreviousMedia}
          />
        )}
        {!isLast && (
          <button
            type="button"
            dir={lang.isRtl ? 'rtl' : undefined}
            className={buildClassName(styles.navigation, styles.navigation_next)}
            aria-label={lang('Next')}
            onClick={selectNextMedia}
          />
        )}
      </div>

      <div className={styles.info} dir={lang.isRtl ? 'rtl' : 'auto'}>
        {(user || chat) && (
          <FullNameTitle
            peer={(user || chat)!}
            withEmojiStatus
            emojiStatusSize={EMOJI_STATUS_SIZE}
            isSavedMessages={isSavedMessages}
            onEmojiStatusClick={handleClickPremium}
            noLoopLimit
          />
        )}
        {!isSavedMessages && renderStatus()}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId, forceShowSelf }): StateProps => {
    const { connectionState } = global;
    const user = selectUser(global, userId);
    const userStatus = selectUserStatus(global, userId);
    const chat = selectChat(global, userId);
    const isSavedMessages = !forceShowSelf && user && user.isSelf;
    const { animationLevel } = global.settings.byKey;
    const { mediaId, avatarOwnerId } = selectTabState(global).mediaViewer;
    const isForum = chat?.isForum;
    const { threadId: currentTopicId } = selectCurrentMessageList(global) || {};
    const topic = isForum && currentTopicId ? chat?.topics?.[currentTopicId] : undefined;

    return {
      connectionState,
      user,
      userStatus,
      chat,
      isSavedMessages,
      animationLevel,
      mediaId,
      avatarOwnerId,
      ...(topic && {
        topic,
        messagesCount: selectThreadMessagesCount(global, userId, currentTopicId!),
      }),
    };
  },
)(ProfileInfo));
