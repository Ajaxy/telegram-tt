import React, {
  memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiStory, ApiTypeStory } from '../../api/types';

import { getStoryMediaHash } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import stopEvent from '../../util/stopEvent';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMenuPosition from '../../hooks/useMenuPosition';

import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MediaAreaOverlay from './mediaArea/MediaAreaOverlay';

import styles from './MediaStory.module.scss';

interface OwnProps {
  story: ApiTypeStory;
  isProtected?: boolean;
  isArchive?: boolean;
}

function MediaStory({ story, isProtected, isArchive }: OwnProps) {
  const {
    openStoryViewer,
    loadPeerSkippedStories,
    toggleStoryPinned,
    showNotification,
  } = getActions();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const getTriggerElement = useLastCallback(() => containerRef.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => document.querySelector('#portals .story-context-menu .bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true, isDense: true }));

  const peerId = story && story.peerId;
  const isFullyLoaded = story && 'content' in story;
  const isDeleted = story && 'isDeleted' in story;
  const video = isFullyLoaded ? (story as ApiStory).content.video : undefined;
  const imageHash = isFullyLoaded ? getStoryMediaHash(story as ApiStory) : undefined;
  const imgBlobUrl = useMedia(imageHash);
  const thumbUrl = imgBlobUrl || video?.thumbnail?.dataUri;

  useEffect(() => {
    if (story && !(isFullyLoaded || isDeleted)) {
      loadPeerSkippedStories({ peerId: story.peerId });
    }
  }, [isDeleted, isFullyLoaded, story]);

  const {
    isContextMenuOpen, contextMenuPosition,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(containerRef);
  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

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

  const handlePinClick = useLastCallback((e: React.SyntheticEvent) => {
    stopEvent(e);

    toggleStoryPinned({ peerId, storyId: story.id, isPinned: true });
    showNotification({
      message: lang('Story.ToastSavedToProfileText'),
    });
    handleContextMenuClose();
  });

  const handleUnpinClick = useLastCallback((e: React.SyntheticEvent) => {
    stopEvent(e);

    toggleStoryPinned({ peerId, storyId: story.id, isPinned: false });
    showNotification({
      message: lang('Story.ToastRemovedFromProfileText'),
    });
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
          <i className={buildClassName(styles.expiredIcon, 'icon icon-story-expired')} aria-hidden />
          {lang('ExpiredStory')}
        </span>
      )}
      <div className={styles.wrapper}>
        {thumbUrl && (
          <img src={thumbUrl} alt="" className={styles.media} draggable={false} />
        )}
        {isFullyLoaded && <MediaAreaOverlay story={story} />}
        {isProtected && <span className="protector" />}
      </div>
      {contextMenuPosition !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          transformOriginX={transformOriginX}
          transformOriginY={transformOriginY}
          positionX={positionX}
          positionY={positionY}
          style={menuStyle}
          className={buildClassName(styles.contextMenu, 'story-context-menu')}
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {isArchive && <MenuItem icon="pin" onClick={handlePinClick}>{lang('StoryList.SaveToProfile')}</MenuItem>}
          {!isArchive && (
            <MenuItem icon="unpin" onClick={handleUnpinClick}>
              {lang('Story.Context.RemoveFromProfile')}
            </MenuItem>
          )}
        </Menu>
      )}
    </div>
  );
}

export default memo(MediaStory);
