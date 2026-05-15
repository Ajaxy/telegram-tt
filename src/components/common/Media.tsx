import { memo, useRef } from '../../lib/teact/teact';

import type { ApiMessage } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { MenuItemContextAction } from '../ui/ListItem';

import {
  getMessageHtmlId,
  getMessageIsSpoiler,
  getMessageVideo,
  getVideoMediaHash,
} from '../../global/helpers';
import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { formatMediaDuration } from '../../util/dates/oldDateFormat';
import stopEvent from '../../util/stopEvent';

import useMessageMediaHash from '../../hooks/media/useMessageMediaHash';
import useThumbnail from '../../hooks/media/useThumbnail';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useFlag from '../../hooks/useFlag';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaTransitionDeprecated from '../../hooks/useMediaTransitionDeprecated';

import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import OptimizedVideo from '../ui/OptimizedVideo';
import MediaSpoiler from './MediaSpoiler';

import './Media.scss';

type OwnProps = {
  message: ApiMessage;
  idPrefix?: string;
  isProtected?: boolean;
  canAutoPlay?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: (messageId: number, chatId: string) => void;
  contextActions?: MenuItemContextAction[];
};

const Media = ({
  message,
  idPrefix = 'shared-media',
  isProtected,
  canAutoPlay,
  observeIntersection,
  onClick,
  contextActions,
}: OwnProps) => {
  const ref = useRef<HTMLDivElement>();
  const menuRef = useRef<HTMLDivElement>();

  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const [isHovering, markMouseOver, markMouseOut] = useFlag();

  const thumbDataUri = useThumbnail(message);
  const mediaHash = useMessageMediaHash(message, 'pictogram');
  const mediaBlobUrl = useMedia(mediaHash, !isIntersecting);
  const transitionClassNames = useMediaTransitionDeprecated(mediaBlobUrl);

  const video = getMessageVideo(message);
  const fullGiftHash = video?.isGif ? getVideoMediaHash(video, 'full') : undefined;
  const fullGifBlobUrl = useMedia(fullGiftHash, !isIntersecting);

  const hasSpoiler = getMessageIsSpoiler(message);
  const [isSpoilerShown, , hideSpoiler] = useFlag(hasSpoiler);

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref, !contextActions);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!.closest('.custom-scroll') || document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const handleClick = useLastCallback(() => {
    if (isContextMenuOpen) return;

    hideSpoiler();
    onClick!(message.id, message.chatId);
  });

  return (
    <div
      ref={ref}
      id={`${idPrefix}${getMessageHtmlId(message.id)}`}
      className={buildClassName('Media scroll-item', contextMenuAnchor && 'has-menu-open')}
      onClick={onClick ? handleClick : undefined}
      onMouseDown={handleBeforeContextMenu}
      onMouseOver={!IS_TOUCH_ENV ? markMouseOver : undefined}
      onMouseOut={!IS_TOUCH_ENV ? markMouseOut : undefined}
      onContextMenu={contextActions ? handleContextMenu : undefined}
    >
      <img
        src={thumbDataUri}
        className="media-miniature"
        alt=""
        draggable={!isProtected}
        decoding="async"
        onContextMenu={isProtected && !contextActions ? stopEvent : undefined}
      />
      {fullGifBlobUrl ? (
        <OptimizedVideo
          canPlay={isIntersecting && !hasSpoiler && isHovering && Boolean(canAutoPlay)}
          src={fullGifBlobUrl}
          className={buildClassName('full-media', 'media-miniature', transitionClassNames)}
          muted
          loop
          playsInline
          draggable={false}
          disablePictureInPicture
          onContextMenu={isProtected && !contextActions ? stopEvent : undefined}
        />
      ) : (
        <img
          src={mediaBlobUrl}
          className={buildClassName('full-media', 'media-miniature', transitionClassNames)}
          alt=""
          draggable={false}
          decoding="async"
          onContextMenu={isProtected && !contextActions ? stopEvent : undefined}
        />
      )}
      {hasSpoiler && (
        <MediaSpoiler
          thumbDataUri={mediaBlobUrl || thumbDataUri}
          isVisible={isSpoilerShown}
          className="media-spoiler"
        />
      )}
      {video && <span className="video-duration">{video.isGif ? 'GIF' : formatMediaDuration(video.duration)}</span>}
      {isProtected && <span className="protector" />}
      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          ref={menuRef}
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="shared-media-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </div>
  );
};

export default memo(Media);
