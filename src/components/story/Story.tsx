import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiMediaAreaChannelPost,
  ApiPeer, ApiStealthMode, ApiStory, ApiTypeStory,
} from '../../api/types';
import type { IDimensions } from '../../global/types';
import type { Signal } from '../../util/signals';
import { MAIN_THREAD_ID } from '../../api/types';

import { EDITABLE_STORY_INPUT_CSS_SELECTOR, EDITABLE_STORY_INPUT_ID } from '../../config';
import { getSenderTitle, isUserId } from '../../global/helpers';
import {
  selectChat, selectIsCurrentUserPremium,
  selectPeer,
  selectPeerStories, selectPeerStory,
  selectTabState, selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { formatMediaDuration, formatRelativeTime } from '../../util/dateFormat';
import download from '../../util/download';
import { getServerTime } from '../../util/serverTime';
import renderText from '../common/helpers/renderText';
import { PRIMARY_VIDEO_MIME, SECONDARY_VIDEO_MIME } from './helpers/videoFormats';

import useUnsupportedMedia from '../../hooks/media/useUnsupportedMedia';
import useAppLayout, { getIsMobile } from '../../hooks/useAppLayout';
import useBackgroundMode from '../../hooks/useBackgroundMode';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useCurrentTimeSignal from '../../hooks/useCurrentTimeSignal';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useLongPress from '../../hooks/useLongPress';
import useMediaTransition from '../../hooks/useMediaTransition';
import useShowTransition from '../../hooks/useShowTransition';
import { useStreaming } from '../../hooks/useStreaming';
import useStoryPreloader from './hooks/useStoryPreloader';
import useStoryProps from './hooks/useStoryProps';

import Avatar from '../common/Avatar';
import Composer from '../common/Composer';
import Icon from '../common/Icon';
import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import OptimizedVideo from '../ui/OptimizedVideo';
import Skeleton from '../ui/placeholder/Skeleton';
import MediaAreaOverlay from './mediaArea/MediaAreaOverlay';
import StoryCaption from './StoryCaption';
import StoryFooter from './StoryFooter';
import StoryProgress from './StoryProgress';

import styles from './StoryViewer.module.scss';

interface OwnProps {
  peerId: string;
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
  onDelete: (story: ApiTypeStory) => void;
  onClose: NoneToVoidFunction;
  onReport: NoneToVoidFunction;
}

interface StateProps {
  peer: ApiPeer;
  forwardSender?: ApiPeer;
  story?: ApiTypeStory;
  isMuted: boolean;
  orderedIds?: number[];
  shouldForcePause?: boolean;
  storyChangelogUserId?: string;
  viewersExpirePeriod: number;
  isChatExist?: boolean;
  areChatSettingsLoaded?: boolean;
  isCurrentUserPremium?: boolean;
  stealthMode: ApiStealthMode;
}

const VIDEO_MIN_READY_STATE = 4;
const SPACEBAR_CODE = 32;

const STEALTH_MODE_NOTIFICATION_DURATION = 4000;

function Story({
  peerId,
  storyId,
  peer,
  forwardSender,
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
  stealthMode,
  onDelete,
  onClose,
  onReport,
}: OwnProps & StateProps) {
  const {
    viewStory,
    setStoryViewerMuted,
    openPreviousStory,
    openNextStory,
    loadPeerSkippedStories,
    openForwardMenu,
    copyStoryLink,
    toggleStoryPinned,
    openChat,
    showNotification,
    openStoryPrivacyEditor,
    loadChatSettings,
    fetchChat,
    loadStoryViews,
    toggleStealthModal,
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
  const [isDropdownMenuOpen, markDropdownMenuOpen, unmarkDropdownMenuOpen] = useFlag(false);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    isDeletedStory,
    hasText,
    hasForwardInfo,
    thumbnail,
    previewBlobUrl,
    isVideo,
    noSound,
    fullMediaData,
    altMediaHash,
    altMediaData,
    hasFullData,
    hasThumb,
    canDownload,
    downloadMediaData,
  } = useStoryProps(story, isCurrentUserPremium, isDropdownMenuOpen);

  const isLoadedStory = story && 'content' in story;

  const isChangelog = peerId === storyChangelogUserId;
  const isChannel = !isUserId(peerId);
  const isOut = isLoadedStory && story.isOut;

  const canPinToProfile = useCurrentOrPrev(
    isOut ? !story.isPinned : undefined,
    true,
  );
  const canUnpinFromProfile = useCurrentOrPrev(
    isOut ? story.isPinned : undefined,
    true,
  );
  const areViewsExpired = Boolean(
    isOut && (story!.date + viewersExpirePeriod) < getServerTime(),
  );

  const forwardSenderTitle = forwardSender ? getSenderTitle(lang, forwardSender)
    : (isLoadedStory && story.forwardInfo?.fromName);

  const canCopyLink = Boolean(
    isLoadedStory
    && story.isPublic
    && !isChangelog
    && peer?.usernames?.length,
  );

  const canShare = Boolean(
    isLoadedStory
    && story.isPublic
    && !story.noForwards
    && !isChangelog
    && !isCaptionExpanded,
  );

  const canPlayStory = Boolean(
    hasFullData && !shouldForcePause && isAppFocused && !isComposerHasFocus && !isCaptionExpanded
    && !isPausedBySpacebar && !isPausedByLongPress,
  );

  const duration = isLoadedStory && story.content.video?.duration
    ? story.content.video.duration
    : undefined;

  const shouldShowFooter = isLoadedStory && (isOut || isChannel);

  const {
    shouldRender: shouldRenderSkeleton, transitionClassNames: skeletonTransitionClassNames,
  } = useShowTransition(!hasFullData);

  const {
    transitionClassNames: mediaTransitionClassNames,
  } = useShowTransition(Boolean(fullMediaData));

  const thumbRef = useCanvasBlur(thumbnail, !hasThumb);
  const previewTransitionClassNames = useMediaTransition(previewBlobUrl);

  const {
    shouldRender: shouldRenderComposer,
    transitionClassNames: composerAppearanceAnimationClassNames,
  } = useShowTransition(!isOut && !isChangelog && !isChannel);

  const {
    shouldRender: shouldRenderCaptionBackdrop,
    transitionClassNames: captionBackdropTransitionClassNames,
  } = useShowTransition(hasText && isCaptionExpanded);

  const { transitionClassNames: appearanceAnimationClassNames } = useShowTransition(true);

  useStreaming(videoRef, fullMediaData, PRIMARY_VIDEO_MIME);

  useStoryPreloader(peerId, storyId);

  useEffect(() => {
    if (storyId) {
      viewStory({ peerId, storyId });
    }
  }, [storyId, peerId]);

  useEffect(() => {
    loadPeerSkippedStories({ peerId });
  }, [peerId]);

  // Fetching user privacy settings for use in Composer
  useEffect(() => {
    const canWrite = isUserId(peerId);
    if (!isChatExist && canWrite) {
      fetchChat({ chatId: peerId });
    }
  }, [isChatExist, peerId]);
  useEffect(() => {
    if (isChatExist && !areChatSettingsLoaded) {
      loadChatSettings({ chatId: peerId });
    }
  }, [areChatSettingsLoaded, isChatExist, peerId]);

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

  const handleDropdownMenuOpen = useLastCallback(() => {
    markDropdownMenuOpen();
    handlePauseStory();
  });

  const handleDropdownMenuClose = useLastCallback(() => {
    unmarkDropdownMenuOpen();
    handlePlayStory();
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
    if (!isOut || isDeletedStory || areViewsExpired) return;

    // Refresh recent viewers list each time
    loadStoryViews({ peerId, storyId, isPreload: true });
  }, [isDeletedStory, areViewsExpired, isOut, peerId, storyId]);

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

  const handleOpenChat = useLastCallback(() => {
    onClose();
    openChat({ id: peerId });
  });

  const handleForwardPeerClick = useLastCallback(() => {
    onClose();
    openChat({ id: forwardSender!.id });
  });

  const handleOpenPrevStory = useLastCallback(() => {
    setCurrentTime(0);
    openPreviousStory();
  });

  const handleOpenNextStory = useLastCallback(() => {
    setCurrentTime(0);
    openNextStory();
  });

  const handleVideoStoryTimeUpdate = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.readyState >= VIDEO_MIN_READY_STATE) {
      setCurrentTime(video.currentTime);
    }
    if (duration && video.currentTime >= duration) {
      handleOpenNextStory();
    }
  });

  useEffect(() => {
    return !getIsAnimating() && !isComposerHasFocus ? captureKeyboardListeners({
      onRight: handleOpenNextStory,
      onLeft: handleOpenPrevStory,
    }) : undefined;
  }, [getIsAnimating, isComposerHasFocus]);

  const handleCopyStoryLink = useLastCallback(() => {
    copyStoryLink({ peerId, storyId });
  });

  const handlePinClick = useLastCallback(() => {
    toggleStoryPinned({ peerId, storyId, isPinned: true });
  });

  const handleUnpinClick = useLastCallback(() => {
    toggleStoryPinned({ peerId, storyId, isPinned: false });
  });

  const handleDeleteStoryClick = useLastCallback(() => {
    setCurrentTime(0);
    onDelete(story!);
  });

  const handleReportStoryClick = useLastCallback(() => {
    onReport();
  });

  const handleForwardClick = useLastCallback(() => {
    openForwardMenu({ fromChatId: peerId, storyId });
  });

  const handleInfoPrivacyEdit = useLastCallback(() => {
    openStoryPrivacyEditor();
  });

  const handleInfoPrivacyClick = useLastCallback(() => {
    const visibility = !isLoadedStory || story.isPublic
      ? undefined
      : story.isForContacts ? 'contacts' : (story.isForCloseFriends ? 'closeFriends' : 'nobody');

    let message;
    const myName = getSenderTitle(lang, peer);
    switch (visibility) {
      case 'nobody':
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

  const handleOpenStealthModal = useLastCallback(() => {
    if (stealthMode.activeUntil && getServerTime() < stealthMode.activeUntil) {
      const diff = stealthMode.activeUntil - getServerTime();
      showNotification({
        title: lang('StealthModeOn'),
        message: lang('Story.ToastStealthModeActiveText', formatMediaDuration(diff)),
        duration: STEALTH_MODE_NOTIFICATION_DURATION,
      });
      return;
    }

    toggleStealthModal({ isOpen: true });
  });

  const handleDownload = useLastCallback(() => {
    if (!downloadMediaData) return;
    download(downloadMediaData, `story-${peerId}-${storyId}.${isVideo ? 'mp4' : 'jpg'}`);
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
          onClick={onTrigger}
          className={buildClassName(styles.button, isOpen && 'active')}
          ariaLabel={lang('AccDescrOpenMenu2')}
        >
          <i className={buildClassName('icon icon-more')} aria-hidden />
        </Button>
      );
    };
  }, [isMobile, lang]);

  function renderStoriesTabs() {
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
    if (isChannel) return undefined;

    let privacyIcon = 'channel-filled';
    const gradient: Record<string, [string, string]> = {
      'channel-filled': ['#50ABFF', '#007AFF'],
      'user-filled': ['#C36EFF', '#8B60FA'],
      'favorite-filled': ['#88D93A', '#30B73B'],
      'group-filled': ['#FFB743', '#F69A36'],
    };

    if (isOut) {
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
        case 'nobody':
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
        className={buildClassName(styles.visibilityButton, isOut && styles.visibilityButtonSelf)}
        onClick={isOut ? handleInfoPrivacyEdit : handleInfoPrivacyClick}
        style={`--color-from: ${gradient[privacyIcon][0]}; --color-to: ${gradient[privacyIcon][1]}`}
      >
        <i className={`icon icon-${privacyIcon}`} aria-hidden />
        {isOut && <i className="icon icon-next" aria-hidden />}
      </div>
    );
  }

  function renderSender() {
    return (
      <div className={styles.sender}>
        <Avatar
          peer={peer}
          size="tiny"
          onClick={handleOpenChat}
        />
        <div className={styles.senderInfo}>
          <span onClick={handleOpenChat} className={styles.senderName}>
            {renderText(getSenderTitle(lang, peer) || '')}
          </span>
          <div className={styles.storyMetaRow}>
            {forwardSenderTitle && (
              <span
                className={buildClassName(
                  styles.storyMeta, styles.forwardHeader, forwardSender && styles.clickable,
                )}
                onClick={forwardSender ? handleForwardPeerClick : undefined}
              >
                <Icon name="loop" />
                <span className={styles.forwardHeaderText}>
                  {renderText(forwardSenderTitle)}
                </span>
              </span>
            )}
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
              className={styles.button}
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
            className={styles.buttonMenu}
            trigger={MenuButton}
            positionX="right"
            onOpen={handleDropdownMenuOpen}
            onClose={handleDropdownMenuClose}
          >
            {canCopyLink && <MenuItem icon="copy" onClick={handleCopyStoryLink}>{lang('CopyLink')}</MenuItem>}
            {canPinToProfile && (
              <MenuItem icon="save-story" onClick={handlePinClick}>{lang('StorySave')}</MenuItem>
            )}
            {canUnpinFromProfile && (
              <MenuItem icon="delete" onClick={handleUnpinClick}>{lang('ArchiveStory')}</MenuItem>
            )}
            {canDownload && (
              <MenuItem icon="download" disabled={!downloadMediaData} onClick={handleDownload}>
                {lang('lng_media_download')}
              </MenuItem>
            )}
            <MenuItem icon="eye-closed-outline" onClick={handleOpenStealthModal}>{lang('StealthMode')}</MenuItem>
            {!isOut && <MenuItem icon="flag" onClick={handleReportStoryClick}>{lang('lng_report_story')}</MenuItem>}
            {isOut && <MenuItem icon="delete" destructive onClick={handleDeleteStoryClick}>{lang('Delete')}</MenuItem>}
          </DropdownMenu>
          <Button
            className={buildClassName(styles.button, styles.closeButton)}
            round
            size="tiny"
            color="translucent-white"
            ariaLabel={lang('Close')}
            onClick={onClose}
          >
            <i className={buildClassName('icon icon-close')} aria-hidden />
          </Button>
        </div>
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
          <img
            src={previewBlobUrl}
            draggable={false}
            alt=""
            className={buildClassName(styles.media, previewTransitionClassNames)}
          />
        )}
        {shouldRenderSkeleton && (
          <Skeleton className={buildClassName(skeletonTransitionClassNames, styles.fullSize)} />
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
            disableRemotePlayback
            onTimeUpdate={handleVideoStoryTimeUpdate}
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
        {isLoadedStory && fullMediaData && (
          <MediaAreaOverlay story={story} isActive />
        )}
      </div>

      {shouldShowFooter && (
        <StoryFooter story={story} className={appearanceAnimationClassNames} areViewsExpired={areViewsExpired} />
      )}
      {shouldRenderCaptionBackdrop && (
        <div
          tabIndex={0}
          role="button"
          className={buildClassName(styles.captionBackdrop, captionBackdropTransitionClassNames)}
          onClick={() => foldCaption()}
          aria-label={lang('Close')}
        />
      )}
      {hasText && <div className={styles.captionGradient} />}
      {(hasText || hasForwardInfo) && (
        <StoryCaption
          key={`caption-${storyId}-${peerId}`}
          story={story as ApiStory}
          isExpanded={isCaptionExpanded}
          onExpand={expandCaption}
          onFold={foldCaption}
          className={appearanceAnimationClassNames}
        />
      )}
      {shouldRenderComposer && (
        <Composer
          type="story"
          chatId={peerId}
          threadId={MAIN_THREAD_ID}
          storyId={storyId}
          isReady={!isOut}
          messageListType="thread"
          isMobile={getIsMobile()}
          editableInputCssSelector={EDITABLE_STORY_INPUT_CSS_SELECTOR}
          editableInputId={EDITABLE_STORY_INPUT_ID}
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
  peerId, storyId, isPrivateStories, isArchivedStories, isReportModalOpen, isDeleteModalOpen,
}): StateProps => {
  const { appConfig } = global;
  const user = selectUser(global, peerId);
  const chat = selectChat(global, peerId);
  const tabState = selectTabState(global);
  const {
    storyViewer: {
      isMuted,
      viewModal,
      isPrivacyModalOpen,
      isStealthModalOpen,
    },
    forwardMessages: { storyId: forwardedStoryId },
    premiumModal,
    safeLinkModalUrl,
    mapModal,
  } = tabState;
  const { isOpen: isPremiumModalOpen } = premiumModal || {};
  const { orderedIds, pinnedIds, archiveIds } = selectPeerStories(global, peerId) || {};
  const story = selectPeerStory(global, peerId, storyId);
  const shouldForcePause = Boolean(
    viewModal || forwardedStoryId || tabState.reactionPicker?.storyId || isReportModalOpen || isPrivacyModalOpen
    || isPremiumModalOpen || isDeleteModalOpen || safeLinkModalUrl || isStealthModalOpen || mapModal,
  );

  const forwardInfo = (story && 'forwardInfo' in story) ? story.forwardInfo : undefined;
  const mediaAreas = (story && 'mediaAreas' in story) ? story.mediaAreas : undefined;
  const forwardSenderId = forwardInfo?.fromPeerId
    || mediaAreas?.find((area): area is ApiMediaAreaChannelPost => area.type === 'channelPost')?.channelId;
  const forwardSender = forwardSenderId ? selectPeer(global, forwardSenderId) : undefined;

  return {
    peer: (user || chat)!,
    forwardSender,
    story,
    orderedIds: isArchivedStories ? archiveIds : (isPrivateStories ? pinnedIds : orderedIds),
    isMuted,
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
    shouldForcePause,
    storyChangelogUserId: appConfig!.storyChangelogUserId,
    viewersExpirePeriod: appConfig!.storyExpirePeriod + appConfig!.storyViewersExpirePeriod,
    isChatExist: Boolean(chat),
    areChatSettingsLoaded: Boolean(chat?.settings),
    stealthMode: global.stories.stealthMode,
  };
})(Story));
