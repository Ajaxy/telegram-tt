import type React from '../../lib/teact/teact';
import { memo, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiPeer } from '../../api/types';
import { StoryViewerOrigin } from '../../types';

import { getPeerTitle } from '../../global/helpers/peers';
import buildClassName from '../../util/buildClassName';
import { isUserId } from '../../util/entities/ids';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import useStoryPreloader from './hooks/useStoryPreloader';

import Avatar from '../common/Avatar';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import styles from './StoryRibbon.module.scss';

interface OwnProps {
  peer: ApiPeer;
  isArchived?: boolean;
}

function StoryRibbonButton({ peer, isArchived }: OwnProps) {
  const {
    openChat,
    openChatWithInfo,
    openStoryViewer,
    toggleStoriesHidden,
  } = getActions();

  const lang = useOldLang();
  const ref = useRef<HTMLDivElement>();

  const isSelf = 'isSelf' in peer && peer.isSelf;
  const isChannel = !isUserId(peer.id);

  useStoryPreloader(peer.id);

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => ref.current!.querySelector('.story-peer-context-menu .bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true, isDense: true }));

  const handleClick = useLastCallback(() => {
    if (isContextMenuOpen) return;

    openStoryViewer({ peerId: peer.id, origin: StoryViewerOrigin.StoryRibbon });
  });

  const handleMouseDown = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    preventMessageInputBlurWithBubbling(e);
    handleBeforeContextMenu(e);
  });

  const handleSavedStories = useLastCallback(() => {
    openChatWithInfo({ id: peer.id, shouldReplaceHistory: true, profileTab: 'stories' });
  });

  const handleArchivedStories = useLastCallback(() => {
    openChatWithInfo({ id: peer.id, shouldReplaceHistory: true, profileTab: 'storiesArchive' });
  });

  const handleOpenChat = useLastCallback(() => {
    openChat({ id: peer.id, shouldReplaceHistory: true });
  });

  const handleOpenProfile = useLastCallback(() => {
    openChatWithInfo({ id: peer.id, shouldReplaceHistory: true });
  });

  const handleArchivePeer = useLastCallback(() => {
    toggleStoriesHidden({ peerId: peer.id, isHidden: !isArchived });
  });

  return (
    <div
      ref={ref}
      role="button"
      data-peer-id={peer.id}
      tabIndex={0}
      className={styles.peer}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <Avatar
        peer={peer}
        withStory
        storyViewerOrigin={StoryViewerOrigin.StoryRibbon}
        storyViewerMode="full"
      />
      <div className={buildClassName(styles.name, peer.hasUnreadStories && styles.name_hasUnreadStory)}>
        {isSelf ? lang('MyStory') : getPeerTitle(lang, peer)}
      </div>
      {contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className={buildClassName('story-peer-context-menu', styles.contextMenu)}
          autoClose
          withPortal
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        >
          {isSelf ? (
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
              {!isChannel && (
                <MenuItem onClick={handleOpenChat} icon="message">
                  {lang('SendMessageTitle')}
                </MenuItem>
              )}
              {isChannel ? (
                <MenuItem onClick={handleOpenProfile} icon="channel">
                  {lang('ChatList.ContextOpenChannel')}
                </MenuItem>
              ) : (
                <MenuItem onClick={handleOpenProfile} icon="user">
                  {lang('StoryList.Context.ViewProfile')}
                </MenuItem>
              )}
              <MenuItem
                onClick={handleArchivePeer}
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
