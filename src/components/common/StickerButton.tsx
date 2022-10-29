import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import React, {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { ApiBotInlineMediaResult, ApiSticker } from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';
import safePlay from '../../util/safePlay';
import { IS_TOUCH_ENV, IS_WEBM_SUPPORTED } from '../../util/environment';
import { selectIsAlwaysHighPriorityEmoji } from '../../global/selectors';
import { getStickerPreviewHash } from '../../global/helpers';

import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useShowTransition from '../../hooks/useShowTransition';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useContextMenuPosition from '../../hooks/useContextMenuPosition';
import useThumbnail from '../../hooks/useThumbnail';

import AnimatedSticker from './AnimatedSticker';
import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import OptimizedVideo from '../ui/OptimizedVideo';

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
  isCurrentUserPremium?: boolean;
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
  isCurrentUserPremium,
}: OwnProps<T>) => {
  const { openStickerSet, openPremiumModal } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const localMediaHash = `sticker${sticker.id}`;
  const stickerSelector = `sticker-button-${sticker.id}`;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const thumbDataUri = useThumbnail(sticker);
  const previewBlobUrl = useMedia(getStickerPreviewHash(sticker.id), !isIntersecting, ApiMediaFormat.BlobUrl);

  const shouldPlay = isIntersecting && !noAnimate;
  const lottieData = useMedia(sticker.isLottie && localMediaHash, !shouldPlay);
  const [isLottieLoaded, markLoaded, unmarkLoaded] = useFlag(Boolean(lottieData));
  const canLottiePlay = isLottieLoaded && shouldPlay;
  const isVideo = sticker.isVideo && IS_WEBM_SUPPORTED;
  const isCustomEmoji = sticker.isCustomEmoji;
  const videoBlobUrl = useMedia(isVideo && localMediaHash, !shouldPlay, ApiMediaFormat.BlobUrl);
  const canVideoPlay = Boolean(isVideo && videoBlobUrl && shouldPlay);
  const isPremiumSticker = sticker.hasEffect;
  const isLocked = !isCurrentUserPremium && isPremiumSticker;

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
    if (isLocked) {
      openPremiumModal({ initialSection: 'premium_stickers' });
      return;
    }
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
    openStickerSet({ stickerSetInfo: sticker.stickerSetInfo });
  }, [openStickerSet, sticker]);

  const shouldShowCloseButton = !IS_TOUCH_ENV && onRemoveRecentClick;

  const fullClassName = buildClassName(
    'StickerButton',
    onClick && 'interactive',
    isCustomEmoji && 'custom-emoji',
    stickerSelector,
    className,
  );

  const style = (thumbDataUri && !canLottiePlay && !canVideoPlay) ? `background-image: url('${thumbDataUri}');` : '';

  const contextMenuItems = useMemo(() => {
    const items: ReactNode[] = [];
    if (noContextMenu || isCustomEmoji) return items;

    if (onUnfaveClick) {
      items.push(
        <MenuItem icon="favorite" onClick={handleContextUnfave}>
          {lang('Stickers.RemoveFromFavorites')}
        </MenuItem>,
      );
    }

    if (onFaveClick) {
      items.push(
        <MenuItem icon="favorite" onClick={handleContextFave}>
          {lang('Stickers.AddToFavorites')}
        </MenuItem>,
      );
    }

    if (!isLocked && onClick) {
      if (!isSavedMessages) {
        items.push(<MenuItem onClick={handleSendQuiet} icon="muted">{lang('SendWithoutSound')}</MenuItem>);
      }
      items.push(
        <MenuItem onClick={handleSendScheduled} icon="calendar">
          {lang(isSavedMessages ? 'SetReminder' : 'ScheduleMessage')}
        </MenuItem>,
      );
    }

    if (canViewSet) {
      items.push(
        <MenuItem onClick={handleOpenSet} icon="stickers">
          {lang('ViewPackPreview')}
        </MenuItem>,
      );
    }
    if (onRemoveRecentClick) {
      items.push(
        <MenuItem icon="delete" onClick={handleContextRemoveRecent}>
          {lang('DeleteFromRecent')}
        </MenuItem>,
      );
    }
    return items;
  }, [
    canViewSet, handleContextFave, handleContextRemoveRecent, handleContextUnfave, handleOpenSet, handleSendQuiet,
    handleSendScheduled, isLocked, isSavedMessages, lang, onFaveClick, onRemoveRecentClick, onUnfaveClick, onClick,
    noContextMenu, isCustomEmoji,
  ]);

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
        <OptimizedVideo
          canPlay={canVideoPlay}
          className={previewTransitionClassNames}
          src={videoBlobUrl}
          loop
          playsInline
          disablePictureInPicture
          muted
        />
      )}
      {shouldPlay && lottieData && (
        <AnimatedSticker
          tgsUrl={lottieData}
          play
          size={size}
          isLowPriority={!selectIsAlwaysHighPriorityEmoji(getGlobal(), sticker.stickerSetInfo)}
          onLoad={markLoaded}
        />
      )}
      {isLocked && (
        <div
          className="sticker-locked"
        >
          <i className="icon-lock-badge" />
        </div>
      )}
      {isPremiumSticker && !isLocked && (
        <div className="sticker-premium">
          <i className="icon-premium" />
        </div>
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
      {Boolean(contextMenuItems.length) && contextMenuPosition !== undefined && (
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
          {contextMenuItems}
        </Menu>
      )}
    </div>
  );
};

export default memo(StickerButton);
