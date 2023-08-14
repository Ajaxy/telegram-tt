import React, {
  memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiStory, ApiTypeStory } from '../../api/types';

import { getStoryMediaHash } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import stopEvent from '../../util/stopEvent';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import useMedia from '../../hooks/useMedia';
import useLang from '../../hooks/useLang';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useMenuPosition from '../../hooks/useMenuPosition';
import useLastCallback from '../../hooks/useLastCallback';

import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import styles from './MediaStory.module.scss';

interface OwnProps {
  story: ApiTypeStory;
  isProtected?: boolean;
  isArchive?: boolean;
}

function MediaStory({ story, isProtected, isArchive }: OwnProps) {
  const {
    openStoryViewer,
    loadUserSkippedStories,
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

  const isFullyLoaded = story && 'content' in story;
  const isDeleted = story && 'isDeleted' in story;
  const video = isFullyLoaded ? (story as ApiStory).content.video : undefined;
  const imageHash = isFullyLoaded ? getStoryMediaHash(story as ApiStory) : undefined;
  const imgBlobUrl = useMedia(imageHash);
  const thumbUrl = imgBlobUrl || video?.thumbnail?.dataUri;

  useEffect(() => {
    if (story && !(isFullyLoaded || isDeleted)) {
      loadUserSkippedStories({ userId: story.userId });
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
      userId: story.userId,
      storyId: story.id,
      isSingleUser: true,
      isPrivate: true,
      isArchive,
    });
  }, [isArchive, story.id, story.userId]);

  const handleMouseDown = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    preventMessageInputBlurWithBubbling(e);
    handleBeforeContextMenu(e);
  });

  const handlePinClick = useLastCallback((e: React.SyntheticEvent) => {
    stopEvent(e);

    toggleStoryPinned({ storyId: story.id, isPinned: true });
    showNotification({
      message: lang('Story.ToastSavedToProfileText'),
    });
    handleContextMenuClose();
  });

  const handleUnpinClick = useLastCallback((e: React.SyntheticEvent) => {
    stopEvent(e);

    toggleStoryPinned({ storyId: story.id, isPinned: false });
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
          <img src={thumbUrl} alt="" className={styles.media} />
        )}
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
