import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiStory, ApiTypeStory, ApiUser } from '../../api/types';
import type { IDimensions } from '../../global/types';
import type { Signal } from '../../util/signals';

import { ApiMediaFormat, MAIN_THREAD_ID } from '../../api/types';
import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';
import {
  getStoryMediaHash, getUserFirstOrLastName, hasMessageText,
} from '../../global/helpers';
import { formatRelativeTime } from '../../util/dateFormat';
import { getServerTime } from '../../util/serverTime';
import { selectChat, selectIsCurrentUserPremium, selectTabState } from '../../global/selectors';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import useAppLayout, { getIsMobile } from '../../hooks/useAppLayout';
import useLang from '../../hooks/useLang';
import useMedia from '../../hooks/useMedia';
import useStoryPreloader from './hooks/useStoryPreloader';
import useBackgroundMode from '../../hooks/useBackgroundMode';
import useShowTransition from '../../hooks/useShowTransition';
import useLastCallback from '../../hooks/useLastCallback';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';
import useCurrentTimeSignal from '../../hooks/useCurrentTimeSignal';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useLongPress from '../../hooks/useLongPress';
import useUnsupportedMedia from '../../hooks/media/useUnsupportedMedia';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useMediaTransition from '../../hooks/useMediaTransition';

import Button from '../ui/Button';
import Avatar from '../common/Avatar';
import OptimizedVideo from '../ui/OptimizedVideo';
import StoryProgress from './StoryProgress';
import Composer from '../common/Composer';
import MenuItem from '../ui/MenuItem';
import DropdownMenu from '../ui/DropdownMenu';
import Skeleton from '../ui/Skeleton';
import StoryCaption from './StoryCaption';
import AvatarList from '../common/AvatarList';

import styles from './StoryViewer.module.scss';

interface OwnProps {
  userId: string;
  storyId: number;
  dimensions: IDimensions;
  // eslint-disable-next-line react/no-unused-prop-types
  isReportModalOpen?: boolean;
  // eslint-disable-next-line react/no-unused-prop-types
  isDeleteModalOpen?: boolean;
  isPrivateStories?: boolean;
  isArchivedStories?: boolean;
  isSingleStory?: boolean;
  getIsAnimating: Signal<boolean>;
  onDelete: (storyId: number) => void;
  onClose: NoneToVoidFunction;
  onReport: NoneToVoidFunction;
}

interface StateProps {
  user: ApiUser;
  story?: ApiTypeStory;
  isMuted: boolean;
  isSelf: boolean;
  orderedIds?: number[];
  shouldForcePause?: boolean;
  storyChangelogUserId?: string;
  viewersExpirePeriod: number;
  isChatExist?: boolean;
  areChatSettingsLoaded?: boolean;
  isCurrentUserPremium?: boolean;
}

const VIDEO_MIN_READY_STATE = 4;
const SPACEBAR_CODE = 32;

const PRIMARY_VIDEO_MIME = 'video/mp4; codecs=hvc1.1.6.L63.00';
const SECONDARY_VIDEO_MIME = 'video/mp4; codecs=avc1.64001E';

function Story({
  isSelf,
  userId,
  storyId,
  user,
  isMuted,
  isArchivedStories,
  isPrivateStories,
  story,
  orderedIds,
  isSingleStory,
  dimensions,
  shouldForcePause,
  storyChangelogUserId,
  viewersExpirePeriod,
  isChatExist,
  areChatSettingsLoaded,
  getIsAnimating,
  isCurrentUserPremium,
  onDelete,
  onClose,
  onReport,
}: OwnProps & StateProps) {
  const {
    viewStory,
    setStoryViewerMuted,
    openPreviousStory,
    openNextStory,
    loadUserSkippedStories,
    openForwardMenu,
    openStorySeenBy,
    copyStoryLink,
    toggleStoryPinned,
    openChat,
    showNotification,
    openStoryPrivacyEditor,
    loadChatSettings,
    fetchChat,
    loadStorySeenBy,
  } = getActions();
  const serverTime = getServerTime();

  const lang = useLang();
  const { isMobile } = useAppLayout();
  const [, setCurrentTime] = useCurrentTimeSignal();
  const [isComposerHasFocus, markComposerHasFocus, unmarkComposerHasFocus] = useFlag(false);
  const [isStoryPlaybackRequested, playStory, pauseStory] = useFlag(false);
  const [isStoryPlaying, markStoryPlaying, unmarkStoryPlaying] = useFlag(false);
  const [isAppFocused, markAppFocused, unmarkAppFocused] = useFlag(true);
  const [isCaptionExpanded, expandCaption, foldCaption] = useFlag(false);
  const [isPausedBySpacebar, setIsPausedBySpacebar] = useState(false);
  const [isPausedByLongPress, markIsPausedByLongPress, unmarkIsPausedByLongPress] = useFlag(false);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);
  const isLoadedStory = story && 'content' in story;
  const isDeletedStory = story && 'isDeleted' in story;
  const hasText = isLoadedStory ? hasMessageText(story) : false;
  const canPinToProfile = useCurrentOrPrev(
    isSelf && isLoadedStory ? !story.isPinned : undefined,
    true,
  );
  const canUnpinFromProfile = useCurrentOrPrev(
    isSelf && isLoadedStory ? story.isPinned : undefined,
    true,
  );
  const areViewsExpired = Boolean(
    isSelf && !isCurrentUserPremium && isLoadedStory && (story!.date + viewersExpirePeriod) < getServerTime(),
  );
  const canCopyLink = Boolean(
    isLoadedStory
    && story.isPublic
    && userId !== storyChangelogUserId
    && user?.usernames?.length,
  );
  const canShare = Boolean(
    isLoadedStory
    && story.isPublic
    && !story.noForwards
    && userId !== storyChangelogUserId
    && !isCaptionExpanded,
  );

  let thumbnail: string | undefined;
  if (isLoadedStory) {
    if (story.content.photo?.thumbnail) {
      thumbnail = story.content.photo.thumbnail.dataUri;
    }
    if (story.content.video?.thumbnail?.dataUri) {
      thumbnail = story.content.video.thumbnail.dataUri;
    }
  }

  const previewHash = isLoadedStory ? getStoryMediaHash(story) : undefined;
  const previewBlobUrl = useMedia(previewHash);
  const isVideo = Boolean(isLoadedStory && story.content.video);
  const noSound = isLoadedStory && story.content.video?.noSound;
  const fullMediaHash = isLoadedStory ? getStoryMediaHash(story, 'full') : undefined;
  const fullMediaData = useMedia(fullMediaHash, !story, isVideo ? ApiMediaFormat.Progressive : ApiMediaFormat.BlobUrl);
  const altMediaHash = isVideo && isLoadedStory ? getStoryMediaHash(story, 'full', true) : undefined;
  const altMediaData = useMedia(altMediaHash, !story, ApiMediaFormat.Progressive);

  const hasFullData = Boolean(fullMediaData || altMediaData);
  const canPlayStory = Boolean(
    hasFullData && !shouldForcePause && isAppFocused && !isComposerHasFocus && !isCaptionExpanded
    && !isPausedBySpacebar && !isPausedByLongPress,
  );
  const {
    shouldRender: shouldRenderSkeleton, transitionClassNames: skeletonTransitionClassNames,
  } = useShowTransition((isVideo && !hasFullData) || (!isVideo && !previewBlobUrl));

  const {
    transitionClassNames: mediaTransitionClassNames,
  } = useShowTransition(Boolean(fullMediaData));

  const hasThumb = !previewBlobUrl && !hasFullData;
  const thumbRef = useCanvasBlur(thumbnail, !hasThumb);
  const previewTransitionClassNames = useMediaTransition(previewBlobUrl);

  const {
    shouldRender: shouldRenderComposer,
    transitionClassNames: composerAppearanceAnimationClassNames,
  } = useShowTransition(!isSelf);

  const {
    shouldRender: shouldRenderCaptionBackdrop,
    transitionClassNames: captionBackdropTransitionClassNames,
  } = useShowTransition(hasText && isCaptionExpanded);

  const { transitionClassNames: appearanceAnimationClassNames } = useShowTransition(true);

  useStoryPreloader(userId, storyId);

  useEffect(() => {
    if (storyId) {
      viewStory({ userId, storyId });
    }
  }, [storyId, userId]);

  useEffect(() => {
    loadUserSkippedStories({ userId });
  }, [userId]);

  // Fetching user privacy settings for use in Composer
  useEffect(() => {
    if (!isChatExist) {
      fetchChat({ chatId: userId });
    }
  }, [isChatExist, userId]);
  useEffect(() => {
    if (isChatExist && !areChatSettingsLoaded) {
      loadChatSettings({ chatId: userId });
    }
  }, [areChatSettingsLoaded, isChatExist, userId]);

  const handlePauseStory = useLastCallback(() => {
    if (isVideo) {
      videoRef.current?.pause();
    }

    unmarkStoryPlaying();
    pauseStory();
  });

  const handlePlayStory = useLastCallback(() => {
    if (!canPlayStory) return;

    playStory();
    if (!isVideo) markStoryPlaying();
  });

  const handleLongPressStart = useLastCallback(() => {
    markIsPausedByLongPress();
  });
  const handleLongPressEnd = useLastCallback(() => {
    unmarkIsPausedByLongPress();
  });

  const {
    onMouseDown: handleLongPressMouseDown,
    onMouseUp: handleLongPressMouseUp,
    onMouseLeave: handleLongPressMouseLeave,
    onTouchStart: handleLongPressTouchStart,
    onTouchEnd: handleLongPressTouchEnd,
  } = useLongPress(handleLongPressStart, handleLongPressEnd);

  const isUnsupported = useUnsupportedMedia(videoRef, undefined, !isVideo || !fullMediaData);

  const hasAllData = fullMediaData && (!altMediaHash || altMediaData);
  // Play story after media has been downloaded
  useEffect(() => { if (hasAllData && !isUnsupported) handlePlayStory(); }, [hasAllData, isUnsupported]);
  useBackgroundMode(unmarkAppFocused, markAppFocused);

  useEffect(() => {
    if (!hasAllData) return;
    videoRef.current?.load();
  }, [hasAllData]);

  useEffect(() => {
    if (!isSelf || isDeletedStory || areViewsExpired) return;

    // Refresh recent viewers list each time
    loadStorySeenBy({ storyId });
  }, [isDeletedStory, areViewsExpired, isSelf, storyId]);

  useEffect(() => {
    if (
      shouldForcePause || !isAppFocused || isComposerHasFocus
      || isCaptionExpanded || isPausedBySpacebar || isPausedByLongPress
    ) {
      handlePauseStory();
    } else {
      handlePlayStory();
    }
  }, [
    handlePlayStory, isAppFocused, isCaptionExpanded, isComposerHasFocus,
    shouldForcePause, isPausedBySpacebar, isPausedByLongPress,
  ]);

  useEffect(() => {
    if (isComposerHasFocus || shouldForcePause || isCaptionExpanded) {
      return undefined;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.keyCode === SPACEBAR_CODE) {
        e.preventDefault();
        setIsPausedBySpacebar(!isPausedBySpacebar);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCaptionExpanded, isComposerHasFocus, isPausedBySpacebar, shouldForcePause]);

  // Reset the state of `isPausedBySpacebar` when closing the caption, losing focus by composer or disable forced pause
  useEffectWithPrevDeps(([
    prevIsComposerHasFocus,
    prevIsCaptionExpanded,
    prevShouldForcePause,
    prevIsAppFocused,
    prevIsPausedByLongPress,
  ]) => {
    if (
      !isPausedBySpacebar || isCaptionExpanded || isComposerHasFocus
      || shouldForcePause || !isAppFocused || isPausedByLongPress
    ) return;

    if (
      prevIsCaptionExpanded !== isCaptionExpanded
      || prevIsComposerHasFocus !== isComposerHasFocus
      || prevShouldForcePause !== shouldForcePause
      || prevIsAppFocused !== isAppFocused
      || prevIsPausedByLongPress !== isPausedByLongPress
    ) {
      setIsPausedBySpacebar(false);
    }
  }, [isComposerHasFocus, isCaptionExpanded, shouldForcePause, isAppFocused, isPausedByLongPress, isPausedBySpacebar]);

  const handleVideoStoryTimeUpdate = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.readyState >= VIDEO_MIN_READY_STATE) {
      setCurrentTime(video.currentTime);
    }
  });

  const handleOpenChat = useLastCallback(() => {
    onClose();
    openChat({ id: userId });
  });

  const handleOpenPrevStory = useLastCallback(() => {
    setCurrentTime(0);
    openPreviousStory();
  });

  const handleOpenNextStory = useLastCallback(() => {
    setCurrentTime(0);
    openNextStory();
  });

  useEffect(() => {
    return !getIsAnimating() && !isComposerHasFocus ? captureKeyboardListeners({
      onRight: handleOpenNextStory,
      onLeft: handleOpenPrevStory,
    }) : undefined;
  }, [getIsAnimating, isComposerHasFocus]);

  const handleCopyStoryLink = useLastCallback(() => {
    copyStoryLink({ userId, storyId });
  });

  const handlePinClick = useLastCallback(() => {
    toggleStoryPinned({ storyId, isPinned: true });
  });

  const handleUnpinClick = useLastCallback(() => {
    toggleStoryPinned({ storyId, isPinned: false });
  });

  const handleDeleteStoryClick = useLastCallback(() => {
    setCurrentTime(0);
    onDelete(story!.id);
  });

  const handleReportStoryClick = useLastCallback(() => {
    onReport();
  });

  const handleForwardClick = useLastCallback(() => {
    openForwardMenu({ fromChatId: userId, storyId });
    handlePauseStory();
  });

  const handleOpenStorySeenBy = useLastCallback(() => {
    openStorySeenBy({ storyId });
  });

  const handleInfoPrivacyEdit = useLastCallback(() => {
    openStoryPrivacyEditor();
  });

  const handleInfoPrivacyClick = useLastCallback(() => {
    const visibility = !isLoadedStory || story.isPublic
      ? undefined
      : story.isForContacts ? 'contacts' : (story.isForCloseFriends ? 'closeFriends' : 'selectedContacts');

    let message;
    const myName = getUserFirstOrLastName(user);
    switch (visibility) {
      case 'selectedContacts':
        message = lang('StorySelectedContactsHint', myName);
        break;
      case 'contacts':
        message = lang('StoryContactsHint', myName);
        break;
      case 'closeFriends':
        message = lang('StoryCloseFriendsHint', myName);
        break;
      default:
        return;
    }
    showNotification({ message });
  });

  const handleVolumeMuted = useLastCallback(() => {
    if (noSound) {
      showNotification({
        message: lang('Story.TooltipVideoHasNoSound'),
      });
      return;
    }
    // Browser requires explicit user interaction to keep video playing after unmuting
    videoRef.current!.muted = !videoRef.current!.muted;
    setStoryViewerMuted({ isMuted: !isMuted });
  });

  useEffect(() => {
    if (!isDeletedStory) return;

    showNotification({
      message: lang('StoryNotFound'),
    });
  }, [lang, isDeletedStory]);

  const MenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => {
      return (
        <Button
          round
          ripple={!isMobile}
          size="tiny"
          color="translucent-white"
          className={isOpen ? 'active' : ''}
          onClick={onTrigger}
          ariaLabel={lang('AccDescrOpenMenu2')}
        >
          <i className="icon icon-more" aria-hidden />
        </Button>
      );
    };
  }, [isMobile, lang]);

  function renderStoriesTabs() {
    const duration = isLoadedStory && story.content.video?.duration
      ? story.content.video.duration
      : undefined;

    return (
      <div className={styles.storyIndicators}>
        {(isSingleStory ? [storyId] : orderedIds ?? []).map((id) => (
          <StoryProgress
            key={`progress-${id}`}
            isActive={id === story?.id}
            isVideo={isVideo}
            isViewed={Boolean(story?.id && ((isPrivateStories || isArchivedStories) ? id > story?.id : id < story?.id))}
            isPaused={!isStoryPlaying}
            duration={duration}
            onImageComplete={handleOpenNextStory}
          />
        ))}
      </div>
    );
  }

  function renderStoryPrivacyButton() {
    let privacyIcon = 'channel-filled';
    const gradient: Record<string, [string, string]> = {
      'channel-filled': ['#50ABFF', '#007AFF'],
      'user-filled': ['#C36EFF', '#8B60FA'],
      'favorite-filled': ['#88D93A', '#30B73B'],
      'group-filled': ['#FFB743', '#F69A36'],
    };

    if (isSelf) {
      const { visibility } = (story && 'visibility' in story && story.visibility) || {};

      switch (visibility) {
        case 'everybody':
          privacyIcon = 'channel-filled';
          break;
        case 'contacts':
          privacyIcon = 'user-filled';
          break;
        case 'closeFriends':
          privacyIcon = 'favorite-filled';
          break;
        case 'selectedContacts':
          privacyIcon = 'group-filled';
      }
    } else {
      if (!story || !('content' in story) || story.isPublic) {
        return undefined;
      }

      privacyIcon = story.isForCloseFriends
        ? 'favorite-filled'
        : (story.isForContacts ? 'user-filled' : 'group-filled');
    }

    return (
      <div
        className={buildClassName(styles.visibilityButton, isSelf && styles.visibilityButtonSelf)}
        onClick={isSelf ? handleInfoPrivacyEdit : handleInfoPrivacyClick}
        style={`--color-from: ${gradient[privacyIcon][0]}; --color-to: ${gradient[privacyIcon][1]}`}
      >
        <i className={`icon icon-${privacyIcon}`} aria-hidden />
        {isSelf && <i className="icon icon-next" aria-hidden />}
      </div>
    );
  }

  function renderSender() {
    return (
      <div className={styles.sender}>
        <Avatar
          peer={user}
          size="tiny"
          onClick={handleOpenChat}
        />
        <div className={styles.senderInfo}>
          <span onClick={handleOpenChat} className={styles.senderName}>
            {renderText(getUserFirstOrLastName(user) || '')}
          </span>
          <div className={styles.storyMetaRow}>
            {story && 'date' in story && (
              <span className={styles.storyMeta}>{formatRelativeTime(lang, serverTime, story.date)}</span>
            )}
            {isLoadedStory && story.isEdited && (
              <span className={styles.storyMeta}>{lang('Story.HeaderEdited')}</span>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          {renderStoryPrivacyButton()}
          {isVideo && (
            <Button
              className={buildClassName(styles.button, styles.buttonVolume)}
              round
              ripple={!isMobile}
              size="tiny"
              color="translucent-white"
              disabled={!hasFullData}
              onClick={handleVolumeMuted}
              ariaLabel={lang('Volume')}
            >
              <i
                className={buildClassName(
                  'icon',
                  isMuted || noSound ? 'icon-speaker-muted-story' : 'icon-speaker-story',
                )}
                aria-hidden
              />
            </Button>
          )}
          <DropdownMenu
            className={buildClassName(styles.button, styles.buttonMenu)}
            trigger={MenuButton}
            positionX="right"
            onOpen={handlePauseStory}
            onClose={handlePlayStory}
          >
            {canCopyLink && <MenuItem icon="copy" onClick={handleCopyStoryLink}>{lang('CopyLink')}</MenuItem>}
            {canPinToProfile && (
              <MenuItem icon="save-story" onClick={handlePinClick}>{lang('StorySave')}</MenuItem>
            )}
            {canUnpinFromProfile && (
              <MenuItem icon="delete" onClick={handleUnpinClick}>{lang('ArchiveStory')}</MenuItem>
            )}
            {isSelf && <MenuItem icon="delete" destructive onClick={handleDeleteStoryClick}>{lang('Delete')}</MenuItem>}
            {!isSelf && <MenuItem icon="flag" onClick={handleReportStoryClick}>{lang('Report')}</MenuItem>}
          </DropdownMenu>
        </div>
      </div>
    );
  }

  const recentViewers = useMemo(() => {
    const { users: { byId: usersById } } = getGlobal();

    const recentViewerIds = story && 'recentViewerIds' in story ? story.recentViewerIds : undefined;
    if (!recentViewerIds) return undefined;

    return recentViewerIds.map((id) => usersById[id]).filter(Boolean);
  }, [story]);

  function renderRecentViewers() {
    const { viewsCount } = story as ApiStory;

    if (!viewsCount) {
      return (
        <div className={buildClassName(styles.recentViewers, appearanceAnimationClassNames)}>
          {lang('NobodyViewed')}
        </div>
      );
    }

    return (
      <div
        className={buildClassName(
          styles.recentViewers,
          styles.recentViewersInteractive,
          appearanceAnimationClassNames,
        )}
        onClick={handleOpenStorySeenBy}
      >
        {!areViewsExpired && Boolean(recentViewers?.length) && (
          <AvatarList
            size="small"
            peers={recentViewers}
          />
        )}

        <span className={styles.recentViewersCount}>{lang('Views', viewsCount, 'i')}</span>
      </div>
    );
  }

  return (
    <div
      className={buildClassName(styles.slideInner, 'component-theme-dark')}
      onMouseDown={handleLongPressMouseDown}
      onMouseUp={handleLongPressMouseUp}
      onMouseLeave={handleLongPressMouseLeave}
      onTouchStart={handleLongPressTouchStart}
      onTouchEnd={handleLongPressTouchEnd}
    >
      <div className={buildClassName(styles.storyHeader, appearanceAnimationClassNames)}>
        {renderStoriesTabs()}
        {renderSender()}
      </div>

      <div
        className={styles.mediaWrapper}
        style={`width: ${dimensions.width}px; height: ${dimensions.height}px`}
      >
        <canvas ref={thumbRef} className={styles.thumbnail} />
        {previewBlobUrl && (
          <img src={previewBlobUrl} alt="" className={buildClassName(styles.media, previewTransitionClassNames)} />
        )}
        {shouldRenderSkeleton && (
          <Skeleton
            width={dimensions.width}
            height={dimensions.height}
            className={buildClassName(skeletonTransitionClassNames, styles.skeleton)}
          />
        )}
        {!isVideo && fullMediaData && (
          <img
            src={fullMediaData}
            alt=""
            className={buildClassName(styles.media, mediaTransitionClassNames)}
            draggable={false}
          />
        )}
        {isVideo && fullMediaData && (
          <OptimizedVideo
            ref={videoRef}
            className={buildClassName(styles.media, mediaTransitionClassNames)}
            canPlay={isStoryPlaybackRequested}
            muted={isMuted}
            draggable={false}
            playsInline
            disablePictureInPicture
            isPriority
            onPlaying={markStoryPlaying}
            onPause={unmarkStoryPlaying}
            onWaiting={unmarkStoryPlaying}
            onTimeUpdate={handleVideoStoryTimeUpdate}
            onEnded={handleOpenNextStory}
          >
            <source src={fullMediaData} type={PRIMARY_VIDEO_MIME} width="720" />
            {altMediaData && <source src={altMediaData} type={SECONDARY_VIDEO_MIME} width="480" />}
          </OptimizedVideo>
        )}

        {!isPausedByLongPress && !isComposerHasFocus && (
          <>
            <button
              type="button"
              className={buildClassName(styles.navigate, styles.prev)}
              onClick={handleOpenPrevStory}
              aria-label={lang('Previous')}
            />
            <button
              type="button"
              className={buildClassName(styles.navigate, styles.next)}
              onClick={handleOpenNextStory}
              aria-label={lang('Next')}
            />
          </>
        )}
      </div>

      {isSelf && renderRecentViewers()}
      {shouldRenderCaptionBackdrop && (
        <div
          tabIndex={0}
          role="button"
          className={buildClassName(styles.captionBackdrop, captionBackdropTransitionClassNames)}
          onClick={() => foldCaption()}
          aria-label={lang('Close')}
        />
      )}
      {hasText && (
        <StoryCaption
          key={`caption-${storyId}-${userId}`}
          story={story as ApiStory}
          isExpanded={isCaptionExpanded}
          onExpand={expandCaption}
          className={appearanceAnimationClassNames}
        />
      )}
      {shouldRenderComposer && (
        <Composer
          type="story"
          chatId={userId}
          threadId={MAIN_THREAD_ID}
          storyId={storyId}
          isReady={!isSelf}
          messageListType="thread"
          isMobile={getIsMobile()}
          editableInputCssSelector="#editable-story-input-text"
          editableInputId="editable-story-input-text"
          inputId="story-input-text"
          className={buildClassName(styles.composer, composerAppearanceAnimationClassNames)}
          inputPlaceholder={lang('ReplyPrivately')}
          onForward={canShare ? handleForwardClick : undefined}
          onFocus={markComposerHasFocus}
          onBlur={unmarkComposerHasFocus}
        />
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, {
  userId, storyId, isPrivateStories, isArchivedStories, isReportModalOpen, isDeleteModalOpen,
}): StateProps => {
  const { currentUserId, appConfig } = global;
  const user = global.users.byId[userId];
  const chat = selectChat(global, userId);
  const tabState = selectTabState(global);
  const {
    storyViewer: { isMuted, storyIdSeenBy, isPrivacyModalOpen },
    forwardMessages: { storyId: forwardedStoryId },
    premiumModal,
  } = tabState;
  const { isOpen: isPremiumModalOpen } = premiumModal || {};
  const {
    byId, orderedIds, pinnedIds, archiveIds,
  } = global.stories.byUserId[userId] || {};
  const story = byId && storyId ? byId[storyId] : undefined;
  const shouldForcePause = Boolean(
    storyIdSeenBy || forwardedStoryId || tabState.reactionPicker?.storyId || isReportModalOpen || isPrivacyModalOpen
    || isPremiumModalOpen || isDeleteModalOpen,
  );

  return {
    user,
    story,
    orderedIds: isArchivedStories ? archiveIds : (isPrivateStories ? pinnedIds : orderedIds),
    isMuted,
    isSelf: currentUserId === userId,
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
    shouldForcePause,
    storyChangelogUserId: appConfig!.storyChangelogUserId,
    viewersExpirePeriod: appConfig!.storyExpirePeriod + appConfig!.storyViewersExpirePeriod,
    isChatExist: Boolean(chat),
    areChatSettingsLoaded: Boolean(chat?.settings),
  };
})(Story));
