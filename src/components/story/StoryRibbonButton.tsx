import { memo, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiPeer } from '../../api/types';
import { StoryViewerOrigin } from '../../types';

import { getPeerTitle } from '../../global/helpers/peers';
import buildClassName from '../../util/buildClassName';
import { formatMediaDuration } from '../../util/dates/dateFormat';
import { isUserId } from '../../util/entities/ids';
import { getServerTime } from '../../util/serverTime';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useStoryPreloader from './hooks/useStoryPreloader';

import Avatar from '../common/Avatar';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import styles from './StoryRibbon.module.scss';

interface OwnProps {
  peer: ApiPeer;
  isArchived?: boolean;
  stealthModeActiveUntil?: number;
}

const STEALTH_MODE_NOTIFICATION_DURATION = 1000;

function StoryRibbonButton({ peer, isArchived, stealthModeActiveUntil }: OwnProps) {
  const {
    openChat,
    openChatWithInfo,
    openStoryViewer,
    toggleStoriesHidden,
    openStealthModal,
    showNotification,
  } = getActions();

  const lang = useLang();
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

  const handleOpenStealth = useLastCallback(() => {
    const diff = stealthModeActiveUntil ? stealthModeActiveUntil - getServerTime() : 0;
    if (diff > 0) {
      showNotification({
        title: lang('StealthModeOnTitle'),
        message: lang('StealthModeOnHint', { time: formatMediaDuration(diff) }),
        duration: STEALTH_MODE_NOTIFICATION_DURATION,
      });
      openStoryViewer({ peerId: peer.id, origin: StoryViewerOrigin.StoryRibbon });
      return;
    }

    openStealthModal({ targetPeerId: peer.id });
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
        {isSelf ? lang('StoryRibbonMyStory') : getPeerTitle(lang, peer)}
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
                {lang('StoryMenuSavedStories')}
              </MenuItem>
              <MenuItem onClick={handleArchivedStories} icon="archive">
                {lang('StoryMenuArchivedStories')}
              </MenuItem>
            </>
          ) : (
            <>
              {!isChannel && (
                <MenuItem onClick={handleOpenChat} icon="message">
                  {lang('StoryMenuSendMessage')}
                </MenuItem>
              )}
              {isChannel ? (
                <MenuItem onClick={handleOpenProfile} icon="channel">
                  {lang('StoryMenuViewChannel')}
                </MenuItem>
              ) : (
                <MenuItem onClick={handleOpenProfile} icon="user">
                  {lang('StoryMenuViewProfile')}
                </MenuItem>
              )}
              {!isChannel && (
                <MenuItem onClick={handleOpenStealth} icon="eye-crossed-outline">
                  {lang('StoryMenuOpenStealth')}
                </MenuItem>
              )}
              <MenuItem
                onClick={handleArchivePeer}
                icon={isArchived ? 'unarchive' : 'archive'}
              >
                {lang(isArchived ? 'StoryMenuUnarchivePeer' : 'StoryMenuArchivePeer')}
              </MenuItem>
            </>
          )}
        </Menu>
      )}
    </div>
  );
}

export default memo(StoryRibbonButton);
