import type { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiBotInlineMediaResult, ApiSticker } from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';
import safePlay from '../../util/safePlay';
import { IS_TOUCH_ENV, IS_WEBM_SUPPORTED } from '../../util/environment';

import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useShowTransition from '../../hooks/useShowTransition';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useContextMenuPosition from '../../hooks/useContextMenuPosition';

import AnimatedSticker from './AnimatedSticker';
import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import './StickerButton.scss';

type OwnProps<T> = {
  sticker: ApiSticker;
  size: number;
  noAnimate?: boolean;
  title?: string;
  className?: string;
  clickArg: T;
  noContextMenu?: boolean;
  isSavedMessages?: boolean;
  canViewSet?: boolean;
  observeIntersection: ObserveFn;
  onClick?: (arg: OwnProps<T>['clickArg'], isSilent?: boolean, shouldSchedule?: boolean) => void;
  onFaveClick?: (sticker: ApiSticker) => void;
  onUnfaveClick?: (sticker: ApiSticker) => void;
  onRemoveRecentClick?: (sticker: ApiSticker) => void;
};

const StickerButton = <T extends number | ApiSticker | ApiBotInlineMediaResult | undefined = undefined>({
  sticker,
  size,
  noAnimate,
  title,
  className,
  clickArg,
  noContextMenu,
  isSavedMessages,
  canViewSet,
  observeIntersection,
  onClick,
  onFaveClick,
  onUnfaveClick,
  onRemoveRecentClick,
}: OwnProps<T>) => {
  const { openStickerSet } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const localMediaHash = `sticker${sticker.id}`;
  const stickerSelector = `sticker-button-${sticker.id}`;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const thumbDataUri = sticker.thumbnail ? sticker.thumbnail.dataUri : undefined;
  const previewBlobUrl = useMedia(`${localMediaHash}?size=m`, !isIntersecting, ApiMediaFormat.BlobUrl);

  const shouldPlay = isIntersecting && !noAnimate;
  const lottieData = useMedia(sticker.isLottie && localMediaHash, !shouldPlay, ApiMediaFormat.Lottie);
  const [isLottieLoaded, markLoaded, unmarkLoaded] = useFlag(Boolean(lottieData));
  const canLottiePlay = isLottieLoaded && shouldPlay;
  const isVideo = sticker.isVideo && IS_WEBM_SUPPORTED;
  const videoBlobUrl = useMedia(isVideo && localMediaHash, !shouldPlay, ApiMediaFormat.BlobUrl);
  const canVideoPlay = Boolean(isVideo && videoBlobUrl && shouldPlay);

  const { transitionClassNames: previewTransitionClassNames } = useShowTransition(
    Boolean(previewBlobUrl || canLottiePlay),
    undefined,
    undefined,
    'slow',
  );

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
    () => ref.current!.querySelector('.sticker-context-menu .bubble'),
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

  // To avoid flickering
  useEffect(() => {
    if (!shouldPlay) {
      unmarkLoaded();
    }
  }, [unmarkLoaded, shouldPlay]);

  useEffect(() => {
    if (!isVideo || !ref.current) return;
    const video = ref.current.querySelector('video');
    if (!video) return;
    if (canVideoPlay) {
      safePlay(video);
    } else {
      video.pause();
    }
  }, [isVideo, canVideoPlay]);

  useEffect(() => {
    if (!isIntersecting) handleContextMenuClose();
  }, [handleContextMenuClose, isIntersecting]);

  const handleClick = () => {
    if (isContextMenuOpen) return;
    onClick?.(clickArg);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    preventMessageInputBlurWithBubbling(e);
    handleBeforeContextMenu(e);
  };

  const handleRemoveClick = useCallback((e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();
    e.preventDefault();

    onRemoveRecentClick!(sticker);
  }, [onRemoveRecentClick, sticker]);

  const handleContextRemoveRecent = useCallback(() => {
    onRemoveRecentClick!(sticker);
  }, [onRemoveRecentClick, sticker]);

  const handleContextUnfave = useCallback(() => {
    onUnfaveClick!(sticker);
  }, [onUnfaveClick, sticker]);

  const handleContextFave = useCallback(() => {
    onFaveClick!(sticker);
  }, [onFaveClick, sticker]);

  const handleSendQuiet = useCallback(() => {
    onClick?.(clickArg, true);
  }, [clickArg, onClick]);

  const handleSendScheduled = useCallback(() => {
    onClick?.(clickArg, undefined, true);
  }, [clickArg, onClick]);

  const handleOpenSet = useCallback(() => {
    openStickerSet({ sticker });
  }, [openStickerSet, sticker]);

  const shouldShowCloseButton = !IS_TOUCH_ENV && onRemoveRecentClick;

  const fullClassName = buildClassName(
    'StickerButton',
    onClick && 'interactive',
    stickerSelector,
    className,
  );

  const style = (thumbDataUri && !canLottiePlay && !canVideoPlay) ? `background-image: url('${thumbDataUri}');` : '';

  return (
    <div
      ref={ref}
      className={fullClassName}
      title={title || (sticker?.emoji)}
      style={style}
      data-sticker-id={sticker.id}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {!canLottiePlay && !canVideoPlay && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img src={previewBlobUrl} className={previewTransitionClassNames} />
      )}
      {isVideo && (
        <video
          className={previewTransitionClassNames}
          src={videoBlobUrl}
          autoPlay={canVideoPlay}
          loop
          playsInline
          muted
        />
      )}
      {shouldPlay && lottieData && (
        <AnimatedSticker
          id={localMediaHash}
          animationData={lottieData}
          play
          size={size}
          isLowPriority
          onLoad={markLoaded}
        />
      )}
      {shouldShowCloseButton && (
        <Button
          className="sticker-remove-button"
          color="dark"
          round
          onClick={handleRemoveClick}
        >
          <i className="icon-close" />
        </Button>
      )}
      {!noContextMenu && onClick && contextMenuPosition !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          transformOriginX={transformOriginX}
          transformOriginY={transformOriginY}
          positionX={positionX}
          positionY={positionY}
          style={menuStyle}
          className="sticker-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        >
          {onUnfaveClick && (
            <MenuItem icon="favorite" onClick={handleContextUnfave}>
              {lang('Stickers.RemoveFromFavorites')}
            </MenuItem>
          )}
          {onFaveClick && (
            <MenuItem icon="favorite" onClick={handleContextFave}>
              {lang('AddToFavorites')}
            </MenuItem>
          )}
          {!isSavedMessages && <MenuItem onClick={handleSendQuiet} icon="muted">{lang('SendWithoutSound')}</MenuItem>}
          <MenuItem onClick={handleSendScheduled} icon="calendar">
            {lang(isSavedMessages ? 'SetReminder' : 'ScheduleMessage')}
          </MenuItem>
          {canViewSet && (
            <MenuItem onClick={handleOpenSet} icon="stickers">
              {lang('ViewPackPreview')}
            </MenuItem>
          )}
          {onRemoveRecentClick && (
            <MenuItem icon="delete" onClick={handleContextRemoveRecent}>
              {lang('DeleteFromRecent')}
            </MenuItem>
          )}
        </Menu>
      )}
    </div>
  );
};

export default memo(StickerButton);
