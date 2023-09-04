import React, { memo, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiUser } from '../../api/types';
import { StoryViewerOrigin } from '../../types';

import buildClassName from '../../util/buildClassName';
import { getUserFirstOrLastName } from '../../global/helpers';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import useLang from '../../hooks/useLang';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useLastCallback from '../../hooks/useLastCallback';
import useMenuPosition from '../../hooks/useMenuPosition';
import useStoryPreloader from './hooks/useStoryPreloader';

import Avatar from '../common/Avatar';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import styles from './StoryRibbon.module.scss';

interface OwnProps {
  user: ApiUser;
  isArchived?: boolean;
}

function StoryRibbonButton({ user, isArchived }: OwnProps) {
  const {
    openChat,
    openChatWithInfo,
    openStoryViewer,
    toggleStoriesHidden,
  } = getActions();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  useStoryPreloader(user.id);

  const {
    isContextMenuOpen, contextMenuPosition,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => ref.current!.querySelector('.story-user-context-menu .bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true, isDense: true }));

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

  const handleClick = useLastCallback(() => {
    if (isContextMenuOpen) return;

    openStoryViewer({ userId: user.id, origin: StoryViewerOrigin.StoryRibbon });
  });

  const handleMouseDown = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    preventMessageInputBlurWithBubbling(e);
    handleBeforeContextMenu(e);
  });

  const handleSavedStories = useLastCallback(() => {
    openChatWithInfo({ id: user.id, shouldReplaceHistory: true, profileTab: 'stories' });
  });

  const handleArchivedStories = useLastCallback(() => {
    openChatWithInfo({ id: user.id, shouldReplaceHistory: true, profileTab: 'storiesArchive' });
  });

  const handleOpenChat = useLastCallback(() => {
    openChat({ id: user.id, shouldReplaceHistory: true });
  });

  const handleOpenProfile = useLastCallback(() => {
    openChatWithInfo({ id: user.id, shouldReplaceHistory: true });
  });

  const handleArchiveUser = useLastCallback(() => {
    toggleStoriesHidden({ userId: user.id, isHidden: !isArchived });
  });

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      className={styles.user}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <Avatar
        peer={user}
        withStory
        storyViewerOrigin={StoryViewerOrigin.StoryRibbon}
        storyViewerMode="full"
      />
      <div className={buildClassName(styles.name, user.hasUnreadStories && styles.name_hasUnreadStory)}>
        {user.isSelf ? lang('MyStory') : getUserFirstOrLastName(user)}
      </div>
      {contextMenuPosition !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          transformOriginX={transformOriginX}
          transformOriginY={transformOriginY}
          positionX={positionX}
          positionY={positionY}
          style={menuStyle}
          className={buildClassName('story-user-context-menu', styles.contextMenu)}
          autoClose
          withPortal
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        >
          {user.isSelf ? (
            <>
              <MenuItem onClick={handleSavedStories} icon="play-story">
                {lang('StoryList.Context.SavedStories')}
              </MenuItem>
              <MenuItem onClick={handleArchivedStories} icon="archive">
                {lang('StoryList.Context.ArchivedStories')}
              </MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={handleOpenChat} icon="message">
                {lang('SendMessageTitle')}
              </MenuItem>
              <MenuItem onClick={handleOpenProfile} icon="user">
                {lang('StoryList.Context.ViewProfile')}
              </MenuItem>
              <MenuItem
                onClick={handleArchiveUser}
                icon={isArchived ? 'unarchive' : 'archive'}
              >
                {lang(isArchived ? 'StoryList.Context.Unarchive' : 'StoryList.Context.Archive')}
              </MenuItem>
            </>
          )}
        </Menu>
      )}
    </div>
  );
}

export default memo(StoryRibbonButton);
