import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat, ApiPhoto, ApiSticker, ApiTopic, ApiUser, ApiUserStatus,
} from '../../api/types';
import type { GlobalState } from '../../global/types';
import { MediaViewerOrigin } from '../../types';

import {
  getUserStatus, isAnonymousForwardsChat, isChatChannel, isUserId, isUserOnline,
} from '../../global/helpers';
import {
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectTabState,
  selectThreadMessagesCount,
  selectUser,
  selectUserFullInfo,
  selectUserStatus,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import renderText from './helpers/renderText';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePrevious from '../../hooks/usePrevious';
import { useStateRef } from '../../hooks/useStateRef';
import usePhotosPreload from './hooks/usePhotosPreload';

import Transition from '../ui/Transition';
import Avatar from './Avatar';
import FullNameTitle from './FullNameTitle';
import ProfilePhoto from './ProfilePhoto';
import TopicIcon from './TopicIcon';

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
    mediaIndex?: number;
    avatarOwnerId?: string;
    topic?: ApiTopic;
    messagesCount?: number;
    userPersonalPhoto?: ApiPhoto;
    userProfilePhoto?: ApiPhoto;
    userFallbackPhoto?: ApiPhoto;
    chatProfilePhoto?: ApiPhoto;
    emojiStatusSticker?: ApiSticker;
  }
  & Pick<GlobalState, 'isSynced'>;

const EMOJI_STATUS_SIZE = 24;
const EMOJI_TOPIC_SIZE = 120;

const ProfileInfo: FC<OwnProps & StateProps> = ({
  forceShowSelf,
  canPlayVideo,
  user,
  userStatus,
  chat,
  isSynced,
  mediaIndex,
  avatarOwnerId,
  topic,
  messagesCount,
  userPersonalPhoto,
  userProfilePhoto,
  userFallbackPhoto,
  chatProfilePhoto,
  emojiStatusSticker,
}) => {
  const {
    loadFullUser,
    openMediaViewer,
    openPremiumModal,
    openStickerSet,
    openPrivacySettingsNoticeModal,
  } = getActions();

  const lang = useOldLang();

  const { id: userId } = user || {};
  const { id: chatId } = chat || {};
  const photos = user?.photos || chat?.photos || MEMO_EMPTY_ARRAY;
  const prevMediaIndex = usePrevious(mediaIndex);
  const prevAvatarOwnerId = usePrevious(avatarOwnerId);
  const mediaIndexRef = useStateRef(mediaIndex);
  const [hasSlideAnimation, setHasSlideAnimation] = useState(true);
  // slideOptimized doesn't work well when animation is dynamically disabled
  const slideAnimation = hasSlideAnimation ? (lang.isRtl ? 'slideRtl' : 'slide') : 'none';

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const isFirst = photos.length <= 1 || currentPhotoIndex === 0;
  const isLast = photos.length <= 1 || currentPhotoIndex === photos.length - 1;

  // Set the current avatar photo to the last selected photo in Media Viewer after it is closed
  useEffect(() => {
    if (prevAvatarOwnerId && prevMediaIndex !== undefined && mediaIndex === undefined) {
      setHasSlideAnimation(false);
      setCurrentPhotoIndex(prevMediaIndex);
    }
  }, [mediaIndex, prevMediaIndex, prevAvatarOwnerId]);

  // Reset the current avatar photo to the one selected in Media Viewer if photos have changed
  useEffect(() => {
    setHasSlideAnimation(false);
    setCurrentPhotoIndex(mediaIndexRef.current || 0);
  }, [mediaIndexRef, photos]);

  // Deleting the last profile photo may result in an error
  useEffect(() => {
    if (currentPhotoIndex > photos.length) {
      setHasSlideAnimation(false);
      setCurrentPhotoIndex(Math.max(0, photos.length - 1));
    }
  }, [currentPhotoIndex, photos.length]);

  useEffect(() => {
    if (isSynced && userId && !forceShowSelf) {
      loadFullUser({ userId });
    }
  }, [userId, loadFullUser, isSynced, forceShowSelf]);

  usePhotosPreload(photos, currentPhotoIndex);

  const handleProfilePhotoClick = useLastCallback(() => {
    openMediaViewer({
      isAvatarView: true,
      chatId: userId || chatId,
      mediaIndex: currentPhotoIndex,
      origin: forceShowSelf ? MediaViewerOrigin.SettingsAvatar : MediaViewerOrigin.ProfileAvatar,
    });
  });

  const handleStatusClick = useLastCallback(() => {
    if (!userId) {
      openStickerSet({
        stickerSetInfo: emojiStatusSticker!.stickerSetInfo,
      });
      return;
    }

    openPremiumModal({ fromUserId: userId });
  });

  const selectPreviousMedia = useLastCallback(() => {
    if (isFirst) {
      return;
    }
    setHasSlideAnimation(true);
    setCurrentPhotoIndex(currentPhotoIndex - 1);
  });

  const selectNextMedia = useLastCallback(() => {
    if (isLast) {
      return;
    }
    setHasSlideAnimation(true);
    setCurrentPhotoIndex(currentPhotoIndex + 1);
  });

  const handleOpenGetReadDateModal = useLastCallback(() => {
    openPrivacySettingsNoticeModal({ chatId: chat!.id, isReadDate: false });
  });

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
    if (!photos || photos.length <= 1) {
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
    const photo = photos.length > 0
      ? photos[currentPhotoIndex]
      : undefined;
    const profilePhoto = photo || userPersonalPhoto || userProfilePhoto || chatProfilePhoto || userFallbackPhoto;

    return (
      <ProfilePhoto
        key={currentPhotoIndex}
        user={user}
        chat={chat}
        photo={profilePhoto}
        canPlayVideo={Boolean(isActive && canPlayVideo)}
        onClick={handleProfilePhotoClick}
      />
    );
  }

  function renderStatus() {
    const peerId = (chatId || userId)!;

    const isAnonymousForwards = isAnonymousForwardsChat(peerId);
    if (isAnonymousForwards) return undefined;

    if (user) {
      return (
        <div
          className={buildClassName(
            styles.status,
            'status',
            isUserOnline(user, userStatus) && 'online',
          )}
        >
          <span className={styles.userStatus} dir="auto">
            {getUserStatus(lang, user, userStatus)}
          </span>
          {userStatus?.isReadDateRestrictedByMe && (
            <span className={styles.getStatus} onClick={handleOpenGetReadDateModal}>
              <span>{lang('StatusHiddenShow')}</span>
            </span>
          )}
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
        {!forceShowSelf && userPersonalPhoto && (
          <div className={buildClassName(
            styles.fallbackPhoto,
            isFirst && styles.fallbackPhotoVisible,
          )}
          >
            <div className={styles.fallbackPhotoContents}>
              {lang(userPersonalPhoto.isVideo ? 'UserInfo.CustomVideo' : 'UserInfo.CustomPhoto')}
            </div>
          </div>
        )}
        {forceShowSelf && userFallbackPhoto && (
          <div className={buildClassName(
            styles.fallbackPhoto,
            (isFirst || isLast) && styles.fallbackPhotoVisible,
          )}
          >
            <div className={styles.fallbackPhotoContents} onClick={handleSelectFallbackPhoto}>
              {!isLast && (
                <Avatar
                  photo={userFallbackPhoto}
                  className={styles.fallbackPhotoAvatar}
                  size="mini"
                />
              )}
              {lang(userFallbackPhoto.isVideo ? 'UserInfo.PublicVideo' : 'UserInfo.PublicPhoto')}
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
            onEmojiStatusClick={handleStatusClick}
            noLoopLimit
            canCopyTitle
          />
        )}
        {renderStatus()}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    const { isSynced } = global;
    const user = selectUser(global, userId);
    const isPrivate = isUserId(userId);
    const userStatus = selectUserStatus(global, userId);
    const chat = selectChat(global, userId);
    const { mediaIndex, chatId: avatarOwnerId } = selectTabState(global).mediaViewer;
    const isForum = chat?.isForum;
    const { threadId: currentTopicId } = selectCurrentMessageList(global) || {};
    const topic = isForum && currentTopicId ? chat?.topics?.[currentTopicId] : undefined;
    const userFullInfo = isPrivate ? selectUserFullInfo(global, userId) : undefined;
    const chatFullInfo = !isPrivate ? selectChatFullInfo(global, userId) : undefined;

    const emojiStatus = (user || chat)?.emojiStatus;
    const emojiStatusSticker = emojiStatus ? global.customEmojis.byId[emojiStatus.documentId] : undefined;

    return {
      isSynced,
      user,
      userStatus,
      chat,
      userPersonalPhoto: userFullInfo?.personalPhoto,
      userProfilePhoto: userFullInfo?.profilePhoto,
      userFallbackPhoto: userFullInfo?.fallbackPhoto,
      chatProfilePhoto: chatFullInfo?.profilePhoto,
      mediaIndex,
      avatarOwnerId,
      emojiStatusSticker,
      ...(topic && {
        topic,
        messagesCount: selectThreadMessagesCount(global, userId, currentTopicId!),
      }),
    };
  },
)(ProfileInfo));
