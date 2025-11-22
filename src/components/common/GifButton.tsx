import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import type { ApiVideo } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { getVideoMediaHash, getVideoPreviewMediaHash } from '../../global/helpers';
import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import useBuffering from '../../hooks/useBuffering';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import OptimizedVideo from '../ui/OptimizedVideo';
import Spinner from '../ui/Spinner';

import './GifButton.scss';

type OwnProps = {
  gif: ApiVideo;
  observeIntersection: ObserveFn;
  isDisabled?: boolean;
  className?: string;
  onClick?: (gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => void;
  onUnsaveClick?: (gif: ApiVideo) => void;
  isSavedMessages?: boolean;
};

const GifButton: FC<OwnProps> = ({
  gif,
  isDisabled,
  className,
  observeIntersection,
  onClick,
  onUnsaveClick,
  isSavedMessages,
}) => {
  const ref = useRef<HTMLDivElement>();

  const lang = useOldLang();

  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const loadAndPlay = isIntersecting && !isDisabled;
  const previewHash = !gif.hasVideoPreview && gif.thumbnail && getVideoMediaHash(gif, 'pictogram');
  const previewBlobUrl = useMedia(previewHash, !loadAndPlay);

  const [withThumb] = useState(gif.thumbnail?.dataUri && !previewBlobUrl);
  const thumbRef = useCanvasBlur(gif.thumbnail?.dataUri, !withThumb);

  const videoHash = getVideoPreviewMediaHash(gif) || getVideoMediaHash(gif, 'full');
  const videoData = useMedia(videoHash, !loadAndPlay);

  const shouldRenderVideo = Boolean(loadAndPlay && videoData);
  const { isBuffered, bufferingHandlers } = useBuffering(true);
  const shouldRenderSpinner = loadAndPlay && !isBuffered;
  const isVideoReady = loadAndPlay && isBuffered;

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!.closest('.custom-scroll, .no-scrollbar'));
  const getMenuElement = useLastCallback(() => ref.current!.querySelector('.gif-context-menu .bubble'));

  const handleClick = useLastCallback(() => {
    if (isContextMenuOpen || !onClick) return;
    onClick({
      ...gif,
      blobUrl: videoData,
    });
  });

  const handleUnsaveClick = useLastCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onUnsaveClick!(gif);
  });

  const handleContextDelete = useLastCallback(() => {
    onUnsaveClick?.(gif);
  });

  const handleSendQuiet = useLastCallback(() => {
    onClick!({
      ...gif,
      blobUrl: videoData,
    }, true);
  });

  const handleSendScheduled = useLastCallback(() => {
    onClick!({
      ...gif,
      blobUrl: videoData,
    }, undefined, true);
  });

  const handleMouseDown = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    preventMessageInputBlurWithBubbling(e);
    handleBeforeContextMenu(e);
  });

  useEffect(() => {
    if (isDisabled) handleContextMenuClose();
  }, [handleContextMenuClose, isDisabled]);

  const fullClassName = buildClassName(
    'GifButton',
    gif.width && gif.height && gif.width < gif.height ? 'vertical' : 'horizontal',
    onClick && 'interactive',
    className,
  );

  return (
    <div
      ref={ref}
      className={fullClassName}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {!IS_TOUCH_ENV && onUnsaveClick && (
        <Button
          className="gif-unsave-button"
          color="dark"
          pill
          iconName="close"
          iconClassName="gif-unsave-button-icon"
          noFastClick
          onClick={handleUnsaveClick}
        />
      )}
      {withThumb && (
        <canvas
          ref={thumbRef}
          className="thumbnail"
        />
      )}
      {previewBlobUrl && !isVideoReady && (
        <img
          src={previewBlobUrl}
          alt=""
          className="preview"
          draggable={false}
        />
      )}
      {shouldRenderVideo && (
        <OptimizedVideo
          canPlay
          src={videoData}
          autoPlay
          loop
          muted
          disablePictureInPicture
          playsInline
          preload="none"

          {...bufferingHandlers}
        />
      )}
      {shouldRenderSpinner && (
        <Spinner color={previewBlobUrl || withThumb ? 'white' : 'black'} />
      )}
      {onClick && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          className="gif-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        >
          {!isSavedMessages && <MenuItem onClick={handleSendQuiet} icon="mute">{lang('SendWithoutSound')}</MenuItem>}
          <MenuItem onClick={handleSendScheduled} icon="calendar">
            {lang(isSavedMessages ? 'SetReminder' : 'ScheduleMessage')}
          </MenuItem>
          {onUnsaveClick && (
            <MenuItem destructive icon="delete" onClick={handleContextDelete}>{lang('Delete')}</MenuItem>
          )}
        </Menu>
      )}
    </div>
  );
};

export default memo(GifButton);
