import type React from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiTypeStory } from '../../api/types';

import { getStoryMediaHash } from '../../global/helpers';
import { selectChat, selectPinnedStories } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatMediaDuration } from '../../util/dates/dateFormat';
import stopEvent from '../../util/stopEvent';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MediaAreaOverlay from './mediaArea/MediaAreaOverlay';

import styles from './MediaStory.module.scss';

interface OwnProps {
  story: ApiTypeStory;
  isArchive?: boolean;
}

interface StateProps {
  isProtected?: boolean;
  isPinned?: boolean;
  canPin?: boolean;
}

function MediaStory({
  story, isProtected, isArchive, isPinned, canPin,
}: OwnProps & StateProps) {
  const {
    openStoryViewer,
    loadPeerSkippedStories,
    toggleStoryInProfile,
    toggleStoryPinnedToTop,
    showNotification,
  } = getActions();

  const lang = useOldLang();
  const containerRef = useRef<HTMLDivElement>();

  const getTriggerElement = useLastCallback(() => containerRef.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => document.querySelector('#portals .story-context-menu .bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true, isDense: true }));

  const peerId = story && story.peerId;
  const isFullyLoaded = story && 'content' in story;
  const isOwn = isFullyLoaded && story.isOut;
  const isDeleted = story && 'isDeleted' in story;
  const video = isFullyLoaded ? (story).content.video : undefined;
  const duration = video && formatMediaDuration(video.duration);
  const imageHash = isFullyLoaded ? getStoryMediaHash(story) : undefined;
  const imgBlobUrl = useMedia(imageHash);
  const thumbUrl = imgBlobUrl || video?.thumbnail?.dataUri;

  useEffect(() => {
    if (story && !(isFullyLoaded || isDeleted)) {
      loadPeerSkippedStories({ peerId: story.peerId });
    }
  }, [isDeleted, isFullyLoaded, story]);

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(containerRef, !isOwn);

  const handleClick = useCallback(() => {
    openStoryViewer({
      peerId: story.peerId,
      storyId: story.id,
      isSinglePeer: true,
      isPrivate: true,
      isArchive,
    });
  }, [isArchive, story.id, story.peerId]);

  const handleMouseDown = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    preventMessageInputBlurWithBubbling(e);
    handleBeforeContextMenu(e);
  });

  const handleUnarchiveClick = useLastCallback((e: React.SyntheticEvent) => {
    stopEvent(e);

    toggleStoryInProfile({ peerId, storyId: story.id, isInProfile: true });
    showNotification({
      message: lang('Story.ToastSavedToProfileText'),
    });
    handleContextMenuClose();
  });

  const handleArchiveClick = useLastCallback((e: React.SyntheticEvent) => {
    stopEvent(e);

    toggleStoryInProfile({ peerId, storyId: story.id, isInProfile: false });
    showNotification({
      message: lang('Story.ToastRemovedFromProfileText'),
    });
    handleContextMenuClose();
  });

  const handleTogglePinned = useLastCallback(() => {
    toggleStoryPinnedToTop({ peerId, storyId: story.id });
    handleContextMenuClose();
  });

  return (
    <div
      ref={containerRef}
      className={buildClassName(styles.root, 'scroll-item')}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {isDeleted && (
        <span>
          <Icon className={styles.expiredIcon} name="story-expired" />
          {lang('ExpiredStory')}
        </span>
      )}
      {isPinned && <Icon className={buildClassName(styles.overlayIcon, styles.pinnedIcon)} name="pin-badge" />}
      {isFullyLoaded && Boolean(story.views?.viewsCount) && (
        <span className={buildClassName(styles.overlayIcon, styles.viewsCount)}>
          <Icon name="eye" />
          {story.views.viewsCount}
        </span>
      )}
      {duration && <span className={buildClassName(styles.overlayIcon, styles.duration)}>{duration}</span>}
      <div className={styles.wrapper}>
        {thumbUrl && (
          <img src={thumbUrl} alt="" className={styles.media} draggable={false} />
        )}
        {isFullyLoaded && <MediaAreaOverlay story={story} />}
        {isProtected && <span className="protector" />}
      </div>
      {contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className={buildClassName(styles.contextMenu, 'story-context-menu')}
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {isArchive && (
            <MenuItem icon="archive" onClick={handleUnarchiveClick}>
              {lang('StoryList.SaveToProfile')}
            </MenuItem>
          )}
          {!isArchive && (
            <MenuItem icon="archive" onClick={handleArchiveClick}>
              {lang('Story.Context.RemoveFromProfile')}
            </MenuItem>
          )}
          {!isArchive && !isPinned && canPin && (
            <MenuItem icon="pin" onClick={handleTogglePinned}>
              {lang('StoryList.ItemAction.Pin')}
            </MenuItem>
          )}
          {!isArchive && isPinned && (
            <MenuItem icon="unpin" onClick={handleTogglePinned}>
              {lang('StoryList.ItemAction.Unpin')}
            </MenuItem>
          )}
        </Menu>
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, { story }): Complete<StateProps> => {
  const chat = selectChat(global, story.peerId);
  const isProtected = chat?.isProtected;

  const { maxPinnedStoriesCount } = global.appConfig;
  const isOwn = 'isOut' in story && story.isOut;
  const pinnedStories = selectPinnedStories(global, story.peerId);
  const isPinned = pinnedStories?.some((pinnedStory) => pinnedStory.id === story.id);
  const canPinMore = isOwn && (!maxPinnedStoriesCount || (pinnedStories?.length || 0) < maxPinnedStoriesCount);

  return {
    isProtected,
    isPinned,
    canPin: canPinMore,
  };
})(MediaStory));
