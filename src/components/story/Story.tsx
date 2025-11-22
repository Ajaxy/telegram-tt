import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat,
  ApiMediaAreaChannelPost,
  ApiPeer, ApiStealthMode, ApiStory, ApiTypeStory,
} from '../../api/types';
import type { IDimensions } from '../../types';
import type { IconName } from '../../types/icons';
import type { Signal } from '../../util/signals';
import { MAIN_THREAD_ID } from '../../api/types';

import { EDITABLE_STORY_INPUT_CSS_SELECTOR, EDITABLE_STORY_INPUT_ID } from '../../config';
import { isChatChannel } from '../../global/helpers';
import { getPeerTitle } from '../../global/helpers/peers';
import {
  selectChat,
  selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
  selectPeer,
  selectPeerPaidMessagesStars,
  selectPeerStory,
  selectPerformanceSettingsValue,
  selectTabState,
  selectUser,
  selectUserFullInfo,
} from '../../global/selectors';
import { IS_SAFARI } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { formatMediaDuration, formatRelativePastTime } from '../../util/dates/dateFormat';
import download from '../../util/download';
import { isUserId } from '../../util/entities/ids';
import { formatStarsAsIcon } from '../../util/localization/format';
import { round } from '../../util/math';
import { getServerTime } from '../../util/serverTime';
import renderText from '../common/helpers/renderText';
import { BASE_STORY_HEIGHT, BASE_STORY_WIDTH } from './helpers/dimensions';
import { PRIMARY_VIDEO_MIME, SECONDARY_VIDEO_MIME } from './helpers/videoFormats';

import useUnsupportedMedia from '../../hooks/media/useUnsupportedMedia';
import useAppLayout, { getIsMobile } from '../../hooks/useAppLayout';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useLongPress from '../../hooks/useLongPress';
import useMediaTransitionDeprecated from '../../hooks/useMediaTransitionDeprecated';
import useOldLang from '../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';
import { useStreaming } from '../../hooks/useStreaming';
import useBackgroundMode from '../../hooks/window/useBackgroundMode';
import useStoryPreloader from './hooks/useStoryPreloader';
import useStoryProps from './hooks/useStoryProps';

import Avatar from '../common/Avatar';
import Composer from '../common/Composer';
import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import OptimizedVideo from '../ui/OptimizedVideo';
import Skeleton from '../ui/placeholder/Skeleton';
import Transition from '../ui/Transition';
import MediaAreaOverlay from './mediaArea/MediaAreaOverlay';
import StoryCaption from './StoryCaption';
import StoryFooter from './StoryFooter';
import StoryProgress from './StoryProgress';

import styles from './StoryViewer.module.scss';

interface OwnProps {
  peerId: string;
  storyId: number;
  dimensions: IDimensions;

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
  fromPeer?: ApiPeer;
  story?: ApiTypeStory;
  isMuted: boolean;
  orderedIds?: number[];
  shouldForcePause?: boolean;
  storyChangelogUserId?: string;
  viewersExpirePeriod: number;
  isChatExist?: boolean;
  arePeerSettingsLoaded?: boolean;
  isCurrentUserPremium?: boolean;
  stealthMode: ApiStealthMode;
  withHeaderAnimation?: boolean;
  paidMessagesStars?: number;
  isAccountFrozen?: boolean;
}

const VIDEO_MIN_READY_STATE = IS_SAFARI ? 4 : 3;
const SPACEBAR_CODE = 32;

const STEALTH_MODE_NOTIFICATION_DURATION = 4000;

function Story({
  peerId,
  storyId,
  peer,
  forwardSender,
  fromPeer,
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
  arePeerSettingsLoaded,
  getIsAnimating,
  isCurrentUserPremium,
  stealthMode,
  withHeaderAnimation,
  paidMessagesStars,
  isAccountFrozen,
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
    toggleStoryInProfile,
    openChat,
    showNotification,
    openStoryPrivacyEditor,
    loadPeerSettings,
    fetchChat,
    loadStoryViews,
    openStealthModal,
  } = getActions();
  const serverTime = getServerTime();

  const oldLang = useOldLang();
  const lang = useLang();
  const { isMobile } = useAppLayout();
  const [isComposerHasFocus, markComposerHasFocus, unmarkComposerHasFocus] = useFlag(false);
  const [isStoryPlaybackRequested, playStory, pauseStory] = useFlag(false);
  const [isStoryPlaying, markStoryPlaying, unmarkStoryPlaying] = useFlag(false);
  const [isAppFocused, markAppFocused, unmarkAppFocused] = useFlag(true);
  const [isCaptionExpanded, expandCaption, foldCaption] = useFlag(false);
  const [isPausedBySpacebar, setIsPausedBySpacebar] = useState(false);
  const [isPausedByLongPress, markIsPausedByLongPress, unmarkIsPausedByLongPress] = useFlag(false);
  const [isDropdownMenuOpen, markDropdownMenuOpen, unmarkDropdownMenuOpen] = useFlag(false);
  const videoRef = useRef<HTMLVideoElement>();
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
  const isUserStory = isUserId(peerId);
  const isChatStory = !isUserStory;
  const isChannelStory = isChatStory && isChatChannel(peer as ApiChat);
  const isOut = isLoadedStory && story.isOut;
  const isUnsupportedStory = isLoadedStory && Object.keys(story.content).length === 0;

  const canPinToProfile = useCurrentOrPrev(
    isOut ? !story.isInProfile : undefined,
    true,
  );
  const canUnpinFromProfile = useCurrentOrPrev(
    isOut ? story.isInProfile : undefined,
    true,
  );
  const areViewsExpired = Boolean(
    isOut && (story.date + viewersExpirePeriod) < getServerTime(),
  );

  const forwardSenderTitle = forwardSender ? getPeerTitle(lang, forwardSender)
    : (isLoadedStory && story.forwardInfo?.fromName);

  const canCopyLink = Boolean(
    isLoadedStory
    && story.isPublic
    && !isChangelog
    && peer?.hasUsername,
  );

  const canShare = Boolean(
    isLoadedStory
    && story.isPublic
    && !story.noForwards
    && !isChangelog
    && !isCaptionExpanded,
  );

  const canPlayStory = Boolean(
    (hasFullData || isUnsupportedStory)
    && !shouldForcePause && isAppFocused && !isComposerHasFocus && !isCaptionExpanded
    && !isPausedBySpacebar && !isPausedByLongPress,
  );

  const duration = isLoadedStory && story.content.video?.duration
    ? story.content.video.duration
    : undefined;

  const shouldShowComposer = !(isOut && isUserStory) && !isChangelog && !isChannelStory && !isAccountFrozen;
  const shouldShowFooter = isLoadedStory && !shouldShowComposer && (isOut || isChannelStory);
  const headerAnimation = isMobile && withHeaderAnimation ? 'slideFade' : 'none';

  const {
    shouldRender: shouldRenderSkeleton,
    transitionClassNames: skeletonTransitionClassNames,
  } = useShowTransitionDeprecated(!hasFullData && !isUnsupportedStory);

  const {
    transitionClassNames: mediaTransitionClassNames,
  } = useShowTransitionDeprecated(Boolean(fullMediaData) && !isUnsupportedStory);

  const thumbRef = useCanvasBlur(thumbnail, !hasThumb);
  const previewTransitionClassNames = useMediaTransitionDeprecated(previewBlobUrl);

  const {
    shouldRender: shouldRenderComposer,
    transitionClassNames: composerAppearanceAnimationClassNames,
  } = useShowTransitionDeprecated(shouldShowComposer);

  const {
    shouldRender: shouldRenderCaptionBackdrop,
    transitionClassNames: captionBackdropTransitionClassNames,
  } = useShowTransitionDeprecated(hasText && isCaptionExpanded);

  const { transitionClassNames: appearanceAnimationClassNames } = useShowTransitionDeprecated(true);
  const {
    shouldRender: shouldRenderCaption,
    transitionClassNames: captionAppearanceAnimationClassNames,
  } = useShowTransitionDeprecated(hasText || hasForwardInfo);

  const isStreamingSupported = useStreaming(videoRef, fullMediaData, PRIMARY_VIDEO_MIME);

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
    if (isChatExist && !arePeerSettingsLoaded) {
      loadPeerSettings({ peerId });
    }
  }, [arePeerSettingsLoaded, isChatExist, peerId]);

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
  } = useLongPress({
    onStart: handleLongPressStart,
    onEnd: handleLongPressEnd,
  });

  const isUnsupportedVideo = useUnsupportedMedia(
    videoRef,
    undefined,
    !isVideo || !fullMediaData || isStreamingSupported,
  );

  const hasAllData = fullMediaData && (!altMediaHash || altMediaData);
  useEffect(() => {
    // Start progress to the nest slide after media has been downloaded or it is unsupported
    if (hasAllData || isUnsupportedVideo || isUnsupportedStory) handlePlayStory();
  }, [hasAllData, isUnsupportedVideo, isUnsupportedStory]);

  useBackgroundMode(unmarkAppFocused, markAppFocused);

  useEffect(() => {
    if (!hasAllData) return;
    videoRef.current?.load();
  }, [hasAllData]);

  useEffect(() => {
    if (!isLoadedStory || isDeletedStory || areViewsExpired) return;

    if (!isOut && !isChannelStory) return;

    // Refresh counters each time
    loadStoryViews({ peerId, storyId });
  }, [isDeletedStory, areViewsExpired, isLoadedStory, peerId, storyId, isOut, isChannelStory]);

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
    ) {
      return;
    }

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

  const handleFromPeerClick = useLastCallback(() => {
    onClose();
    openChat({ id: fromPeer!.id });
  });

  const handleOpenPrevStory = useLastCallback(() => {
    openPreviousStory();
  });

  const handleOpenNextStory = useLastCallback(() => {
    openNextStory();
  });

  const handleVideoStoryTimeUpdate = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.readyState >= VIDEO_MIN_READY_STATE) {
      markStoryPlaying();
    } else {
      unmarkStoryPlaying();
    }
    if (duration && round(video.currentTime, 2) >= round(duration, 2)) {
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
    toggleStoryInProfile({ peerId, storyId, isInProfile: true });
  });

  const handleUnpinClick = useLastCallback(() => {
    toggleStoryInProfile({ peerId, storyId, isInProfile: false });
  });

  const handleDeleteStoryClick = useLastCallback(() => {
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
    const myName = getPeerTitle(lang, peer);
    switch (visibility) {
      case 'nobody':
        message = oldLang('StorySelectedContactsHint', myName);
        break;
      case 'contacts':
        message = oldLang('StoryContactsHint', myName);
        break;
      case 'closeFriends':
        message = oldLang('StoryCloseFriendsHint', myName);
        break;
      default:
        return;
    }
    showNotification({ message });
  });

  const handleVolumeMuted = useLastCallback(() => {
    if (noSound) {
      showNotification({
        message: oldLang('Story.TooltipVideoHasNoSound'),
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
        title: lang('StealthModeOnTitle'),
        message: lang('StealthModeOnHint', { time: formatMediaDuration(diff) }),
        duration: STEALTH_MODE_NOTIFICATION_DURATION,
      });
      return;
    }

    openStealthModal({});
  });

  const handleDownload = useLastCallback(() => {
    if (!downloadMediaData) return;
    download(downloadMediaData, `story-${peerId}-${storyId}.${isVideo ? 'mp4' : 'jpg'}`);
  });

  useEffect(() => {
    if (!isDeletedStory) return;

    showNotification({
      message: oldLang('StoryNotFound'),
    });
  }, [oldLang, isDeletedStory]);

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
          ariaLabel={lang('AriaLabelOpenMenu')}
          iconName="more"
        />
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
    if (!isUserStory) return undefined;

    let privacyIcon: IconName = 'channel-filled';
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
        <Icon name={privacyIcon} />
        {isOut && <Icon name="next" />}
      </div>
    );
  }

  function renderSenderInfo() {
    return (
      <div className={styles.senderInfo}>
        <Avatar
          peer={peer}
          size="tiny"
          onClick={handleOpenChat}
        />
        <div className={styles.senderMeta}>
          <span onClick={handleOpenChat} className={styles.senderName}>
            {renderText(getPeerTitle(lang, peer) || '')}
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
                <span className={styles.headerTitle}>
                  {renderText(forwardSenderTitle)}
                </span>
              </span>
            )}
            {fromPeer && (
              <span
                className={buildClassName(
                  styles.storyMeta, styles.fromPeer,
                )}
                onClick={handleFromPeerClick}
              >
                <Avatar peer={fromPeer} size="micro" />
                <span className={styles.headerTitle}>
                  {renderText(getPeerTitle(lang, fromPeer) || '')}
                </span>
              </span>
            )}
            {story && 'date' in story && (
              <span className={styles.storyMeta}>{formatRelativePastTime(oldLang, serverTime, story.date)}</span>
            )}
            {isLoadedStory && story.isEdited && (
              <span className={styles.storyMeta}>{oldLang('Story.HeaderEdited')}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderSender() {
    return (
      <div className={styles.sender}>
        <Transition activeKey={Number(peerId)} name={headerAnimation} className={styles.senderInfoTransition}>
          {renderSenderInfo()}
        </Transition>

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
              ariaLabel={oldLang('Volume')}
              iconName={(isMuted || noSound) ? 'speaker-muted-story' : 'speaker-story'}
            />
          )}
          <DropdownMenu
            className={styles.buttonMenu}
            trigger={MenuButton}
            positionX="right"
            onOpen={handleDropdownMenuOpen}
            onClose={handleDropdownMenuClose}
          >
            {canCopyLink && <MenuItem icon="copy" onClick={handleCopyStoryLink}>{oldLang('CopyLink')}</MenuItem>}
            {canPinToProfile && (
              <MenuItem icon="save-story" onClick={handlePinClick}>
                {oldLang(isUserStory ? 'StorySave' : 'SaveToPosts')}
              </MenuItem>
            )}
            {canUnpinFromProfile && (
              <MenuItem icon="delete" onClick={handleUnpinClick}>
                {oldLang(isUserStory ? 'ArchiveStory' : 'RemoveFromPosts')}
              </MenuItem>
            )}
            {canDownload && (
              <MenuItem icon="download" disabled={!downloadMediaData} onClick={handleDownload}>
                {oldLang('lng_media_download')}
              </MenuItem>
            )}
            {!isOut && isUserStory && (
              <MenuItem icon="eye-crossed-outline" onClick={handleOpenStealthModal}>
                {oldLang('StealthMode')}
              </MenuItem>
            )}
            {!isOut && <MenuItem icon="flag" onClick={handleReportStoryClick}>{oldLang('lng_report_story')}</MenuItem>}
            {isOut && (
              <MenuItem
                icon="delete"
                destructive
                onClick={handleDeleteStoryClick}
              >
                {oldLang('Delete')}
              </MenuItem>
            )}
          </DropdownMenu>
          <Button
            className={buildClassName(styles.button, styles.closeButton)}
            round
            size="tiny"
            color="translucent-white"
            ariaLabel={oldLang('Close')}
            onClick={onClose}
            iconName="close"
          />
        </div>
      </div>
    );
  }

  const inputPlaceholder = paidMessagesStars
    ? lang('ComposerPlaceholderPaidReply', {
      amount: formatStarsAsIcon(lang, paidMessagesStars, { asFont: true, className: 'placeholder-star-icon' }),
    }, {
      withNodes: true,
    })
    : oldLang(isChatStory ? 'ReplyToGroupStory' : 'ReplyPrivately');

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
            key={`preview-${storyId}`}
            src={previewBlobUrl}
            draggable={false}
            alt=""
            className={buildClassName(styles.media, styles.mediaPreview, previewTransitionClassNames)}
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
            key={`video-${storyId}`}
            className={buildClassName(styles.media, mediaTransitionClassNames)}
            canPlay={isStoryPlaybackRequested}
            muted={isMuted}
            width={BASE_STORY_WIDTH}
            height={BASE_STORY_HEIGHT}
            draggable={false}
            playsInline
            disablePictureInPicture
            isPriority
            onPause={unmarkStoryPlaying}
            onWaiting={unmarkStoryPlaying}
            disableRemotePlayback
            onTimeUpdate={handleVideoStoryTimeUpdate}
          >
            <source src={fullMediaData} type={PRIMARY_VIDEO_MIME} width="720" />
            {altMediaData && <source src={altMediaData} type={SECONDARY_VIDEO_MIME} width="480" />}
          </OptimizedVideo>
        )}

        {isUnsupportedStory && (
          <div className={buildClassName(styles.media, styles.unsupportedMedia)}>
            <span>{lang('StoryUnsupported')}</span>
          </div>
        )}

        {!isPausedByLongPress && !isComposerHasFocus && (
          <>
            <button
              type="button"
              className={buildClassName(styles.navigate, styles.prev)}
              onClick={handleOpenPrevStory}
              aria-label={oldLang('Previous')}
            />
            <button
              type="button"
              className={buildClassName(styles.navigate, styles.next)}
              onClick={handleOpenNextStory}
              aria-label={oldLang('Next')}
            />
          </>
        )}
        {isLoadedStory && fullMediaData && (
          <MediaAreaOverlay
            key={`area-overlay-${storyId}-${peerId}`}
            story={story}
            isActive
            isStoryPlaying={isDropdownMenuOpen}
          />
        )}
        {!isMobile && (
          <div className={styles.content}>
            <div className={styles.contentInner}>
              <Avatar
                peer={peer}
                withStory
                storyViewerMode="disabled"
              />
              <div className={styles.name}>{renderText(getPeerTitle(lang, peer) || '')}</div>
            </div>
          </div>
        )}
      </div>

      {shouldShowFooter && (
        <StoryFooter story={story} className={appearanceAnimationClassNames} />
      )}
      {shouldRenderCaptionBackdrop && (
        <div
          tabIndex={0}
          role="button"
          className={buildClassName(styles.captionBackdrop, captionBackdropTransitionClassNames)}
          onClick={() => foldCaption()}
          aria-label={oldLang('Close')}
        />
      )}
      {hasText && <div className={buildClassName(styles.captionGradient, captionAppearanceAnimationClassNames)} />}
      {shouldRenderCaption && (
        <StoryCaption
          key={`caption-${storyId}-${peerId}`}
          story={story as ApiStory}
          isExpanded={isCaptionExpanded}
          onExpand={expandCaption}
          onFold={foldCaption}
          className={captionAppearanceAnimationClassNames}
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
          inputPlaceholder={inputPlaceholder}
          onForward={canShare ? handleForwardClick : undefined}
          onFocus={markComposerHasFocus}
          onBlur={unmarkComposerHasFocus}
        />
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, {
  peerId,
  storyId,
  isDeleteModalOpen,
}): Complete<StateProps> => {
  const { appConfig } = global;
  const user = selectUser(global, peerId);
  const chat = selectChat(global, peerId);
  const userFullInfo = selectUserFullInfo(global, peerId);
  const tabState = selectTabState(global);
  const {
    storyViewer: {
      isMuted,
      viewModal,
      isPrivacyModalOpen,
      storyList,
    },
    forwardMessages: { storyId: forwardedStoryId },
    premiumModal,
    safeLinkModalUrl,
    mapModal,
    reportModal,
    giftInfoModal,
    isPaymentMessageConfirmDialogOpen,
    storyStealthModal,
  } = tabState;
  const { isOpen: isPremiumModalOpen } = premiumModal || {};
  const isStealthModalOpen = Boolean(storyStealthModal);
  const story = selectPeerStory(global, peerId, storyId);
  const isLoadedStory = story && 'content' in story;
  const shouldForcePause = Boolean(
    isPaymentMessageConfirmDialogOpen
    || viewModal || forwardedStoryId || tabState.reactionPicker?.storyId || reportModal || isPrivacyModalOpen
    || isPremiumModalOpen || isDeleteModalOpen || safeLinkModalUrl || isStealthModalOpen || mapModal || giftInfoModal,
  );

  const forwardInfo = isLoadedStory ? story.forwardInfo : undefined;
  const mediaAreas = isLoadedStory ? story.mediaAreas : undefined;
  const forwardSenderId = forwardInfo?.fromPeerId
    || mediaAreas?.find((area): area is ApiMediaAreaChannelPost => area.type === 'channelPost')?.channelId;
  const forwardSender = forwardSenderId ? selectPeer(global, forwardSenderId) : undefined;
  const withHeaderAnimation = selectPerformanceSettingsValue(global, 'mediaViewerAnimations');

  const fromPeer = isLoadedStory && story.fromId ? selectPeer(global, story.fromId) : undefined;
  const paidMessagesStars = selectPeerPaidMessagesStars(global, peerId);
  const isAccountFrozen = selectIsCurrentUserFrozen(global);

  return {
    peer: (user || chat)!,
    forwardSender,
    fromPeer,
    story,
    orderedIds: storyList?.storyIdsByPeerId[peerId],
    isMuted,
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
    shouldForcePause,
    storyChangelogUserId: appConfig.storyChangelogUserId,
    viewersExpirePeriod: appConfig.storyViewersExpirePeriod,
    isChatExist: Boolean(chat),
    arePeerSettingsLoaded: Boolean(userFullInfo?.settings),
    stealthMode: global.stories.stealthMode,
    withHeaderAnimation,
    paidMessagesStars,
    isAccountFrozen,
  };
})(Story));
