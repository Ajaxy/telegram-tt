import { memo, useEffect, useMemo, useState } from '../../../lib/teact/teact';

import type {
  ApiChat,
  ApiEmojiStatusType,
  ApiPeerColorOption,
  ApiPeerPhotos,
  ApiPeerProfileColorSet,
  ApiSavedGifts,
  ApiSticker,
  ApiTopic,
  ApiUser,
  ApiUserFullInfo,
  ApiUserStatus,
} from '../../../api/types/index';
import type { IconName } from '../../../types/icons/index';
import type { AnimationLevel, ThemeKey } from '../../../types/index';
import { MediaViewerOrigin } from '../../../types/index';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config.ts';
import {
  getUserStatus, isAnonymousForwardsChat, isChatChannel, isSystemBot, isUserOnline,
} from '../../../global/helpers/index';
import { getActions, withGlobal } from '../../../global/index';
import {
  selectChat,
  selectCurrentMessageList,
  selectCustomEmoji,
  selectPeer,
  selectPeerHasProfileBackground,
  selectPeerPhotos,
  selectPeerProfileColor,
  selectPeerSavedGifts,
  selectTabState,
  selectTheme,
  selectThreadMessagesCount,
  selectTopic,
  selectUser,
  selectUserFullInfo,
  selectUserStatus,
} from '../../../global/selectors/index';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { captureEvents, SwipeDirection } from '../../../util/captureEvents';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { resolveTransitionName } from '../../../util/resolveTransitionName';
import { REM } from '../helpers/mediaDimensions.ts';
import renderText from '../helpers/renderText.tsx';

import { useVtn } from '../../../hooks/animations/useVtn';
import useIntervalForceUpdate from '../../../hooks/schedulers/useIntervalForceUpdate';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useCustomEmoji from '../hooks/useCustomEmoji';
import usePhotosPreload from '../hooks/usePhotosPreload';

import Transition from '../../ui/Transition.tsx';
import Avatar from '../Avatar.tsx';
import FullNameTitle from '../FullNameTitle.tsx';
import Icon from '../icons/Icon.tsx';
import TopicIcon from '../TopicIcon.tsx';
import ProfilePhoto from './ProfilePhoto';
import ProfilePinnedGifts from './ProfilePinnedGifts.tsx';
import RadialPatternBackground from './RadialPatternBackground.tsx';

import './ProfileInfo.scss';
import styles from './ProfileInfo.module.scss';

type OwnProps = {
  isExpanded?: boolean;
  peerId: string;
  isForSettings?: boolean;
  canPlayVideo: boolean;
  isForMonoforum?: boolean;
  onExpand?: NoneToVoidFunction;
};

type StateProps = {
  user?: ApiUser;
  userFullInfo?: ApiUserFullInfo;
  userStatus?: ApiUserStatus;
  chat?: ApiChat;
  mediaIndex?: number;
  avatarOwnerId?: string;
  topic?: ApiTopic;
  messagesCount?: number;
  animationLevel: AnimationLevel;
  emojiStatus?: ApiEmojiStatusType;
  emojiStatusSticker?: ApiSticker;
  emojiStatusSlug?: string;
  profilePhotos?: ApiPeerPhotos;
  profileColorOption?: ApiPeerColorOption<ApiPeerProfileColorSet>;
  theme: ThemeKey;
  isPlain?: boolean;
  savedGifts?: ApiSavedGifts;
  hasAvatar?: boolean;
  isSystemAccount?: boolean;
};

const MAX_LEVEL_ICON = 90;

const EMOJI_STATUS_SIZE = 24;
const EMOJI_TOPIC_SIZE = 120;
const LOAD_MORE_THRESHOLD = 3;
const MAX_PHOTO_DASH_COUNT = 30;
const STATUS_UPDATE_INTERVAL = 1000 * 60; // 1 min

const PATTERN_Y_SHIFT = 8 * REM;
const PATTERN_PLAIN_Y_SHIFT = 5.25 * REM;

const ProfileInfo = ({
  isExpanded,
  isForSettings,
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
  emojiStatus,
  emojiStatusSticker,
  emojiStatusSlug,
  profilePhotos,
  peerId,
  isForMonoforum,
  profileColorOption,
  theme,
  isPlain,
  savedGifts,
  hasAvatar,
  isSystemAccount,
  onExpand,
}: OwnProps & StateProps) => {
  const {
    openMediaViewer,
    openPremiumModal,
    openStickerSet,
    openPrivacySettingsNoticeModal,
    loadMoreProfilePhotos,
    openUniqueGiftBySlug,
    openProfileRatingModal,
    loadPeerSavedGifts,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  useIntervalForceUpdate(user ? STATUS_UPDATE_INTERVAL : undefined);

  const { createVtnStyle } = useVtn();

  const photos = profilePhotos?.photos || MEMO_EMPTY_ARRAY;
  const prevMediaIndex = usePreviousDeprecated(mediaIndex);
  const prevAvatarOwnerId = usePreviousDeprecated(avatarOwnerId);
  const [hasSlideAnimation, setHasSlideAnimation] = useState(true);

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const isFirst = photos.length <= 1 || currentPhotoIndex === 0;
  const isLast = photos.length <= 1 || currentPhotoIndex === photos.length - 1;

  const collectibleEmojiStatus = emojiStatus?.type === 'collectible' ? emojiStatus : undefined;

  const peer = user || chat;
  const { customEmoji: backgroundEmoji } = useCustomEmoji(
    collectibleEmojiStatus?.patternDocumentId || peer?.profileColor?.backgroundEmojiId,
  );

  const profileColorSet = useMemo(() => {
    if (collectibleEmojiStatus) {
      return {
        bgColors: [collectibleEmojiStatus.centerColor, collectibleEmojiStatus.edgeColor],
        storyColors: [collectibleEmojiStatus.textColor, collectibleEmojiStatus.textColor],
      };
    }

    const colors = profileColorOption
      && (theme === 'dark' ? profileColorOption.darkColors : profileColorOption.colors);
    if (!colors) return undefined;

    // Why are they reversed on the server?
    return {
      bgColors: [...colors.bgColors].reverse(),
      storyColors: [...colors.storyColors].reverse(),
    };
  }, [profileColorOption, theme, collectibleEmojiStatus]);

  const hasPatternBackground = profileColorSet?.bgColors || backgroundEmoji;

  const pinnedGifts = useMemo(() => {
    return savedGifts?.gifts.filter((gift) => {
      if (gift.gift.type === 'starGiftUnique') {
        return gift.isPinned && gift.gift.slug !== collectibleEmojiStatus?.slug;
      }

      return gift.isPinned;
    });
  }, [savedGifts, collectibleEmojiStatus?.slug]);

  useEffect(() => {
    if (photos.length - currentPhotoIndex <= LOAD_MORE_THRESHOLD) {
      loadMoreProfilePhotos({ peerId });
    }
  }, [currentPhotoIndex, peerId, photos.length]);

  useEffect(() => {
    loadPeerSavedGifts({ peerId });
  }, [peerId]);

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

  // Reset photo index when collapsing
  useEffect(() => {
    if (!isExpanded) {
      setCurrentPhotoIndex(0);
    }
  }, [isExpanded]);

  usePhotosPreload(photos, currentPhotoIndex);

  const handleProfilePhotoClick = useLastCallback(() => {
    openMediaViewer({
      isAvatarView: true,
      chatId: peerId,
      mediaIndex: currentPhotoIndex,
      origin: isForSettings ? MediaViewerOrigin.SettingsAvatar : MediaViewerOrigin.ProfileAvatar,
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

  const handleMinimizedAvatarClick = useLastCallback(() => {
    if (isForSettings) {
      handleProfilePhotoClick();
      return;
    }

    if (hasAvatar) onExpand?.();
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
      <div className={styles.photoDashes} style={createVtnStyle('photoDashes', true)}>
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
        theme={theme}
        canPlayVideo={Boolean(isActive && canPlayVideo)}
        className={buildClassName(isActive && styles.activeProfilePhoto)}
        style={isActive ? createVtnStyle('avatar', true) : undefined}
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
        <span role="button" tabIndex={0} className={styles.userRatingNegativeWrapper} onClick={onRatingClick}>
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
      <span role="button" tabIndex={0} className={styles.userRatingWrapper} onClick={onRatingClick}>
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
        <span
          className={buildClassName(styles.status, 'status')}
          dir="auto"
          style={createVtnStyle('status', true)}
        >
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
          style={createVtnStyle('status', true)}
        >
          {renderUserRating()}
          <span className={styles.userStatus} dir="auto">
            {getUserStatus(oldLang, user, userStatus)}
          </span>
          {userStatus?.isReadDateRestrictedByMe && !isSystemAccount && (
            <span className={styles.getStatus} onClick={handleOpenGetReadDateModal}>
              <span>{oldLang('StatusHiddenShow')}</span>
            </span>
          )}
        </div>
      );
    }

    return (
      <span
        className={buildClassName(styles.status, 'status')}
        dir="auto"
        style={createVtnStyle('status', true)}
      >
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
      className={buildClassName(
        'ProfileInfo',
        styles.root,
        !isExpanded && styles.minimized,
        isPlain && styles.plain,
      )}
      style={buildStyle(
        profileColorSet && `--rating-outline-color: ${isExpanded ? 'transparent' : profileColorSet?.bgColors[0]}`,
        profileColorSet && !isExpanded && `--rating-text-color: ${profileColorSet?.bgColors[0]}`,
        createVtnStyle('profileInfo', true),
      )}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {hasPatternBackground && (
        <RadialPatternBackground
          backgroundColors={profileColorSet?.bgColors}
          patternIcon={backgroundEmoji}
          patternSize={16}
          withLinearGradient={!collectibleEmojiStatus}
          className={styles.radialPatternBackground}
          yPosition={isPlain ? PATTERN_PLAIN_Y_SHIFT : PATTERN_Y_SHIFT}
        />
      )}
      {Boolean(pinnedGifts?.length) && (
        <ProfilePinnedGifts
          peerId={peerId}
          gifts={pinnedGifts}
          isExpanded={isExpanded}
          className={styles.pinnedGifts}
          withGlow={!isPlain}
        />
      )}
      {isExpanded && (
        <div className={styles.photoWrapper} style={createVtnStyle('photoWrapper', true)}>
          {renderPhotoTabs()}
          {!isForSettings && profilePhotos?.personalPhoto && (
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
          {isForSettings && profilePhotos?.fallbackPhoto && (
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
            name={resolveTransitionName('slide', animationLevel, !hasSlideAnimation, lang.isRtl)}
          >
            {renderPhoto}
          </Transition>

          {!isFirst && (
            <button
              type="button"
              dir={lang.isRtl ? 'rtl' : undefined}
              className={buildClassName(styles.navigation, styles.navigation_prev)}
              aria-label={oldLang('AccDescrPrevious')}
              onClick={selectPreviousMedia}
            />
          )}
          {!isLast && (
            <button
              type="button"
              dir={lang.isRtl ? 'rtl' : undefined}
              className={buildClassName(styles.navigation, styles.navigation_next)}
              aria-label={oldLang('Next')}
              onClick={selectNextMedia}
            />
          )}
        </div>
      )}
      {!isExpanded && (
        <Avatar
          withStory
          storyColors={profileColorSet?.storyColors}
          className={styles.standaloneAvatar}
          key={peer?.id}
          size="jumbo"
          peer={peer}
          style={createVtnStyle('avatar', true)}
          onClick={hasAvatar ? handleMinimizedAvatarClick : undefined}
        />
      )}

      <div
        className={styles.info}
        dir={lang.isRtl ? 'rtl' : 'auto'}
        style={createVtnStyle('info', true)}
      >
        {(user || chat) && (
          <FullNameTitle
            className={styles.title}
            style={createVtnStyle('title', true)}
            peer={(user || chat)!}
            withEmojiStatus
            withStatusTextColor
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
    const peer = selectPeer(global, peerId);
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

    const emojiStatus = peer?.emojiStatus;
    const emojiStatusSticker = emojiStatus ? selectCustomEmoji(global, emojiStatus.documentId) : undefined;
    const emojiStatusSlug = emojiStatus?.type === 'collectible' ? emojiStatus.slug : undefined;

    const profileColor = peer && selectPeerProfileColor(global, peer);
    const theme = selectTheme(global);

    const hasBackground = selectPeerHasProfileBackground(global, peerId);
    const savedGifts = selectPeerSavedGifts(global, peerId);
    const hasAvatar = Boolean(peer?.avatarPhotoId);

    const isAnonymousForwards = isAnonymousForwardsChat(peerId);
    const isSystemAccount = isSystemBot(peerId) || isAnonymousForwards || peer?.id === SERVICE_NOTIFICATIONS_USER_ID;

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
      emojiStatus,
      profilePhotos,
      topic,
      messagesCount: topic ? selectThreadMessagesCount(global, peerId, currentTopicId!) : undefined,
      profileColorOption: profileColor,
      theme,
      isPlain: !hasBackground,
      savedGifts,
      hasAvatar,
      isSystemAccount,
    };
  },
)(ProfileInfo));
