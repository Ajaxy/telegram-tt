import type { FC } from '../../lib/teact/teact';
import { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat, ApiPeerPhotos, ApiSticker, ApiTopic, ApiUser, ApiUserFullInfo, ApiUserStatus,
} from '../../api/types';
import type { AnimationLevel } from '../../types';
import type { IconName } from '../../types/icons';
import { MediaViewerOrigin } from '../../types';

import {
  getUserStatus, isAnonymousForwardsChat, isChatChannel, isSystemBot, isUserOnline,
} from '../../global/helpers';
import {
  selectChat,
  selectCurrentMessageList,
  selectCustomEmoji,
  selectPeerPhotos,
  selectTabState,
  selectThreadMessagesCount,
  selectTopic,
  selectUser,
  selectUserFullInfo,
  selectUserStatus,
} from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState.ts';
import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { resolveTransitionName } from '../../util/resolveTransitionName.ts';
import renderText from './helpers/renderText';

import useIntervalForceUpdate from '../../hooks/schedulers/useIntervalForceUpdate';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import usePhotosPreload from './hooks/usePhotosPreload';

import Transition from '../ui/Transition';
import Avatar from './Avatar';
import FullNameTitle from './FullNameTitle';
import Icon from './icons/Icon';
import ProfilePhoto from './ProfilePhoto';
import TopicIcon from './TopicIcon';

import './ProfileInfo.scss';
import styles from './ProfileInfo.module.scss';

const MAX_LEVEL_ICON = 90;

type OwnProps = {
  peerId: string;
  forceShowSelf?: boolean;
  canPlayVideo: boolean;
  isForMonoforum?: boolean;
};

type StateProps =
  {
    user?: ApiUser;
    userFullInfo?: ApiUserFullInfo;
    userStatus?: ApiUserStatus;
    chat?: ApiChat;
    mediaIndex?: number;
    avatarOwnerId?: string;
    topic?: ApiTopic;
    messagesCount?: number;
    animationLevel: AnimationLevel;
    emojiStatusSticker?: ApiSticker;
    emojiStatusSlug?: string;
    profilePhotos?: ApiPeerPhotos;
  };

const EMOJI_STATUS_SIZE = 24;
const EMOJI_TOPIC_SIZE = 120;
const LOAD_MORE_THRESHOLD = 3;
const MAX_PHOTO_DASH_COUNT = 30;
const STATUS_UPDATE_INTERVAL = 1000 * 60; // 1 min

const ProfileInfo: FC<OwnProps & StateProps> = ({
  forceShowSelf,
  canPlayVideo,
  user,
  userFullInfo,
  userStatus,
  chat,
  mediaIndex,
  avatarOwnerId,
  topic,
  messagesCount,
  animationLevel,
  emojiStatusSticker,
  emojiStatusSlug,
  profilePhotos,
  peerId,
  isForMonoforum,
}) => {
  const {
    openMediaViewer,
    openPremiumModal,
    openStickerSet,
    openPrivacySettingsNoticeModal,
    loadMoreProfilePhotos,
    openUniqueGiftBySlug,
    openProfileRatingModal,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  useIntervalForceUpdate(user ? STATUS_UPDATE_INTERVAL : undefined);

  const photos = profilePhotos?.photos || MEMO_EMPTY_ARRAY;
  const prevMediaIndex = usePreviousDeprecated(mediaIndex);
  const prevAvatarOwnerId = usePreviousDeprecated(avatarOwnerId);
  const [hasSlideAnimation, setHasSlideAnimation] = useState(true);

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const isFirst = photos.length <= 1 || currentPhotoIndex === 0;
  const isLast = photos.length <= 1 || currentPhotoIndex === photos.length - 1;

  useEffect(() => {
    if (photos.length - currentPhotoIndex <= LOAD_MORE_THRESHOLD) {
      loadMoreProfilePhotos({ peerId });
    }
  }, [currentPhotoIndex, peerId, photos.length]);

  // Set the current avatar photo to the last selected photo in Media Viewer after it is closed
  useEffect(() => {
    if (prevAvatarOwnerId && prevMediaIndex !== undefined && mediaIndex === undefined) {
      setHasSlideAnimation(false);
      setCurrentPhotoIndex(prevMediaIndex);
    }
  }, [mediaIndex, prevMediaIndex, prevAvatarOwnerId]);

  // Deleting the last profile photo may result in an error
  useEffect(() => {
    if (currentPhotoIndex > photos.length) {
      setHasSlideAnimation(false);
      setCurrentPhotoIndex(Math.max(0, photos.length - 1));
    }
  }, [currentPhotoIndex, photos.length]);

  usePhotosPreload(photos, currentPhotoIndex);

  const handleProfilePhotoClick = useLastCallback(() => {
    openMediaViewer({
      isAvatarView: true,
      chatId: peerId,
      mediaIndex: currentPhotoIndex,
      origin: forceShowSelf ? MediaViewerOrigin.SettingsAvatar : MediaViewerOrigin.ProfileAvatar,
    });
  });

  const handleStatusClick = useLastCallback(() => {
    if (emojiStatusSlug) {
      openUniqueGiftBySlug({ slug: emojiStatusSlug });
      return;
    }
    if (!peerId) {
      openStickerSet({
        stickerSetInfo: emojiStatusSticker!.stickerSetInfo,
      });
      return;
    }

    openPremiumModal({ fromUserId: peerId });
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

  const handleRatingClick = useLastCallback((level: number) => {
    if (user) {
      openProfileRatingModal({ userId: user.id, level });
    }
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
        <h3 className={styles.topicTitle} dir={oldLang.isRtl ? 'rtl' : undefined}>{renderText(topic!.title)}</h3>
        <p className={styles.topicMessagesCounter}>
          {messagesCount ? oldLang('Chat.Title.Topic', messagesCount, 'i') : oldLang('lng_forum_no_messages')}
        </p>
      </div>
    );
  }

  function renderPhotoTabs() {
    const totalPhotosLength = Math.max(photos.length, profilePhotos?.count || 0);
    if (!photos || totalPhotosLength <= 1) {
      return undefined;
    }

    const enumerator = Array.from({ length: Math.min(totalPhotosLength, MAX_PHOTO_DASH_COUNT) });
    const activeDashIndex = currentPhotoIndex >= MAX_PHOTO_DASH_COUNT ? MAX_PHOTO_DASH_COUNT - 1 : currentPhotoIndex;

    return (
      <div className={styles.photoDashes}>
        {enumerator.map((_, i) => (
          <span className={buildClassName(styles.photoDash, i === activeDashIndex && styles.photoDash_current)} />
        ))}
      </div>
    );
  }

  function renderPhoto(isActive?: boolean) {
    const photo = photos.length > 0
      ? photos[currentPhotoIndex]
      : undefined;

    return (
      <ProfilePhoto
        key={currentPhotoIndex}
        user={user}
        chat={chat}
        photo={photo}
        canPlayVideo={Boolean(isActive && canPlayVideo)}
        onClick={handleProfilePhotoClick}
      />
    );
  }

  function renderUserRating() {
    if (!userFullInfo?.starsRating) return undefined;

    const level = userFullInfo.starsRating.level;
    const isNegative = level < 0;

    const onRatingClick = () => handleRatingClick(level);

    if (isNegative) {
      return (
        <span className={styles.userRatingNegativeWrapper} onClick={onRatingClick}>
          <Icon
            name="rating-icons-negative"
            className={styles.ratingNegativeIcon}
          />
          <span className={styles.ratingLevel}>!</span>
        </span>
      );
    }

    const safeLevel = Math.max(level, 1);
    const iconLevel = Math.min(safeLevel, MAX_LEVEL_ICON);
    const iconName = (iconLevel < 10
      ? `rating-icons-level${iconLevel}`
      : `rating-icons-level${Math.floor(iconLevel / 10) * 10}`) as IconName;

    return (
      <span className={styles.userRatingWrapper} onClick={onRatingClick}>
        <Icon
          name={iconName}
          className={styles.ratingIcon}
        />
        <span className={styles.ratingLevel}>{level}</span>
      </span>
    );
  }

  function renderStatus() {
    const isAnonymousForwards = isAnonymousForwardsChat(peerId);
    const isSystemBotChat = isSystemBot(peerId);
    if (isAnonymousForwards || isSystemBotChat) return undefined;

    if (isForMonoforum) {
      return (
        <span className={buildClassName(styles.status, 'status')} dir="auto">
          {lang('MonoforumStatus')}
        </span>
      );
    }

    if (user) {
      return (
        <div
          className={buildClassName(
            styles.status,
            'status',
            isUserOnline(user, userStatus) && 'online',
          )}
        >
          {renderUserRating()}
          <span className={styles.userStatus} dir="auto">
            {getUserStatus(oldLang, user, userStatus)}
          </span>
          {userStatus?.isReadDateRestrictedByMe && (
            <span className={styles.getStatus} onClick={handleOpenGetReadDateModal}>
              <span>{oldLang('StatusHiddenShow')}</span>
            </span>
          )}
        </div>
      );
    }

    return (
      <span className={buildClassName(styles.status, 'status')} dir="auto">
        {
          isChatChannel(chat!)
            ? oldLang('Subscribers', chat!.membersCount ?? 0, 'i')
            : oldLang('Members', chat!.membersCount ?? 0, 'i')
        }
      </span>
    );
  }

  if (topic) {
    return renderTopic();
  }

  return (
    <div
      className={buildClassName('ProfileInfo')}
      dir={oldLang.isRtl ? 'rtl' : undefined}
    >
      <div className={styles.photoWrapper}>
        {renderPhotoTabs()}
        {!forceShowSelf && profilePhotos?.personalPhoto && (
          <div className={buildClassName(
            styles.fallbackPhoto,
            isFirst && styles.fallbackPhotoVisible,
          )}
          >
            <div className={styles.fallbackPhotoContents}>
              {oldLang(profilePhotos.personalPhoto.isVideo ? 'UserInfo.CustomVideo' : 'UserInfo.CustomPhoto')}
            </div>
          </div>
        )}
        {forceShowSelf && profilePhotos?.fallbackPhoto && (
          <div className={buildClassName(
            styles.fallbackPhoto,
            (isFirst || isLast) && styles.fallbackPhotoVisible,
          )}
          >
            <div className={styles.fallbackPhotoContents} onClick={handleSelectFallbackPhoto}>
              {!isLast && (
                <Avatar
                  photo={profilePhotos.fallbackPhoto}
                  className={styles.fallbackPhotoAvatar}
                  size="mini"
                />
              )}
              {oldLang(profilePhotos.fallbackPhoto.isVideo ? 'UserInfo.PublicVideo' : 'UserInfo.PublicPhoto')}
            </div>
          </div>
        )}
        <Transition
          activeKey={currentPhotoIndex}
          name={resolveTransitionName('slide', animationLevel, !hasSlideAnimation, oldLang.isRtl)}
        >
          {renderPhoto}
        </Transition>

        {!isFirst && (
          <button
            type="button"
            dir={oldLang.isRtl ? 'rtl' : undefined}
            className={buildClassName(styles.navigation, styles.navigation_prev)}
            aria-label={oldLang('AccDescrPrevious')}
            onClick={selectPreviousMedia}
          />
        )}
        {!isLast && (
          <button
            type="button"
            dir={oldLang.isRtl ? 'rtl' : undefined}
            className={buildClassName(styles.navigation, styles.navigation_next)}
            aria-label={oldLang('Next')}
            onClick={selectNextMedia}
          />
        )}
      </div>

      <div className={styles.info} dir={oldLang.isRtl ? 'rtl' : 'auto'}>
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
  (global, { peerId }): Complete<StateProps> => {
    const user = selectUser(global, peerId);
    const userFullInfo = user ? selectUserFullInfo(global, peerId) : undefined;
    const userStatus = selectUserStatus(global, peerId);
    const chat = selectChat(global, peerId);
    const profilePhotos = selectPeerPhotos(global, peerId);
    const { mediaIndex, chatId: avatarOwnerId } = selectTabState(global).mediaViewer;
    const isForum = chat?.isForum;
    const { threadId: currentTopicId } = selectCurrentMessageList(global) || {};
    const topic = isForum && currentTopicId ? selectTopic(global, peerId, currentTopicId) : undefined;
    const { animationLevel } = selectSharedSettings(global);

    const emojiStatus = (user || chat)?.emojiStatus;
    const emojiStatusSticker = emojiStatus ? selectCustomEmoji(global, emojiStatus.documentId) : undefined;
    const emojiStatusSlug = emojiStatus?.type === 'collectible' ? emojiStatus.slug : undefined;

    return {
      user,
      userFullInfo,
      userStatus,
      chat,
      mediaIndex,
      avatarOwnerId,
      animationLevel,
      emojiStatusSticker,
      emojiStatusSlug,
      profilePhotos,
      topic,
      messagesCount: topic ? selectThreadMessagesCount(global, peerId, currentTopicId!) : undefined,
    };
  },
)(ProfileInfo));
