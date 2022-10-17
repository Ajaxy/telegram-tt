import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';

import type { ApiVideo } from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import { IS_TOUCH_ENV } from '../../util/environment';
import buildClassName from '../../util/buildClassName';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import useMedia from '../../hooks/useMedia';
import useBuffering from '../../hooks/useBuffering';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useLang from '../../hooks/useLang';
import useContextMenuPosition from '../../hooks/useContextMenuPosition';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';

import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import OptimizedVideo from '../ui/OptimizedVideo';

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
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const lang = useLang();

  const hasThumbnail = Boolean(gif.thumbnail?.dataUri);
  const localMediaHash = `gif${gif.id}`;
  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const loadAndPlay = isIntersecting && !isDisabled;
  const previewBlobUrl = useMedia(`${localMediaHash}?size=m`, !loadAndPlay, ApiMediaFormat.BlobUrl);
  const thumbRef = useCanvasBlur(gif.thumbnail?.dataUri, Boolean(previewBlobUrl));
  const videoData = useMedia(localMediaHash, !loadAndPlay, ApiMediaFormat.BlobUrl);
  const shouldRenderVideo = Boolean(loadAndPlay && videoData);
  const { isBuffered, bufferingHandlers } = useBuffering(true);
  const shouldRenderSpinner = loadAndPlay && !isBuffered;
  const isVideoReady = loadAndPlay && isBuffered;

  const {
    isContextMenuOpen, contextMenuPosition,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const getTriggerElement = useCallback(() => ref.current, []);

  const getRootElement = useCallback(
    () => ref.current!.closest('.custom-scroll, .no-scrollbar'),
    [],
  );

  const getMenuElement = useCallback(
    () => ref.current!.querySelector('.gif-context-menu .bubble'),
    [],
  );

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useContextMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
  );

  const handleClick = useCallback(() => {
    if (isContextMenuOpen || !onClick) return;
    onClick({
      ...gif,
      blobUrl: videoData,
    });
  }, [isContextMenuOpen, onClick, gif, videoData]);

  const handleUnsaveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onUnsaveClick!(gif);
  }, [onUnsaveClick, gif]);

  const handleContextDelete = useCallback(() => {
    onUnsaveClick?.(gif);
  }, [gif, onUnsaveClick]);

  const handleSendQuiet = useCallback(() => {
    onClick!({
      ...gif,
      blobUrl: videoData,
    }, true);
  }, [gif, onClick, videoData]);

  const handleSendScheduled = useCallback(() => {
    onClick!({
      ...gif,
      blobUrl: videoData,
    }, undefined, true);
  }, [gif, onClick, videoData]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    preventMessageInputBlurWithBubbling(e);
    handleBeforeContextMenu(e);
  }, [handleBeforeContextMenu]);

  useEffect(() => {
    if (isDisabled) handleContextMenuClose();
  }, [handleContextMenuClose, isDisabled]);

  const fullClassName = buildClassName(
    'GifButton',
    gif.width && gif.height && gif.width < gif.height ? 'vertical' : 'horizontal',
    onClick && 'interactive',
    localMediaHash,
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
          onClick={handleUnsaveClick}
        >
          <i className="icon-close gif-unsave-button-icon" />
        </Button>
      )}
      {hasThumbnail && (
        <canvas
          ref={thumbRef}
          className="thumbnail"
          // We need to always render to avoid blur re-calculation
          style={isVideoReady ? 'display: none;' : undefined}
        />
      )}
      {previewBlobUrl && !isVideoReady && (
        <img
          src={previewBlobUrl}
          alt=""
          className="preview"
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
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...bufferingHandlers}
        />
      )}
      {shouldRenderSpinner && (
        <Spinner color={previewBlobUrl || hasThumbnail ? 'white' : 'black'} />
      )}
      {onClick && contextMenuPosition !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          transformOriginX={transformOriginX}
          transformOriginY={transformOriginY}
          positionX={positionX}
          positionY={positionY}
          style={menuStyle}
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
