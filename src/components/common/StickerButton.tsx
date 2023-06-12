import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiBotInlineMediaResult, ApiSticker } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { getServerTimeOffset } from '../../util/serverTime';

import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import useLastCallback from '../../hooks/useLastCallback';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useMenuPosition from '../../hooks/useMenuPosition';
import useDynamicColorListener from '../../hooks/stickers/useDynamicColorListener';

import StickerView from './StickerView';
import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import './StickerButton.scss';

type OwnProps<T> = {
  sticker: ApiSticker;
  size: number;
  noPlay?: boolean;
  title?: string;
  className?: string;
  noContextMenu?: boolean;
  isSavedMessages?: boolean;
  isStatusPicker?: boolean;
  canViewSet?: boolean;
  isSelected?: boolean;
  isCurrentUserPremium?: boolean;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
  withTranslucentThumb?: boolean;
  observeIntersection: ObserveFn;
  observeIntersectionForShowing?: ObserveFn;
  noShowPremium?: boolean;
  onClick?: (arg: OwnProps<T>['clickArg'], isSilent?: boolean, shouldSchedule?: boolean) => void;
  clickArg: T;
  onFaveClick?: (sticker: ApiSticker) => void;
  onUnfaveClick?: (sticker: ApiSticker) => void;
  onRemoveRecentClick?: (sticker: ApiSticker) => void;
  onContextMenuOpen?: NoneToVoidFunction;
  onContextMenuClose?: NoneToVoidFunction;
  onContextMenuClick?: NoneToVoidFunction;
};

const contentForStatusMenuContext = [
  { title: 'SetTimeoutFor.Hours', value: 1, arg: 3600 },
  { title: 'SetTimeoutFor.Hours', value: 2, arg: 7200 },
  { title: 'SetTimeoutFor.Hours', value: 8, arg: 28800 },
  { title: 'SetTimeoutFor.Days', value: 1, arg: 86400 },
  { title: 'SetTimeoutFor.Days', value: 2, arg: 172800 },
];

const StickerButton = <T extends number | ApiSticker | ApiBotInlineMediaResult | undefined = undefined>({
  sticker,
  size,
  noPlay,
  title,
  className,
  noContextMenu,
  isSavedMessages,
  isStatusPicker,
  canViewSet,
  observeIntersection,
  observeIntersectionForShowing,
  isSelected,
  isCurrentUserPremium,
  noShowPremium,
  sharedCanvasRef,
  withTranslucentThumb,
  onClick,
  clickArg,
  onFaveClick,
  onUnfaveClick,
  onRemoveRecentClick,
  onContextMenuOpen,
  onContextMenuClose,
  onContextMenuClick,
}: OwnProps<T>) => {
  const { openStickerSet, openPremiumModal, setEmojiStatus } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const hasCustomColor = sticker.shouldUseTextColor;
  const customColor = useDynamicColorListener(ref, !hasCustomColor);

  const {
    id, isCustomEmoji, hasEffect: isPremium, stickerSetInfo,
  } = sticker;
  const isLocked = !isCurrentUserPremium && isPremium;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const shouldLoad = isIntersecting;
  const shouldPlay = isIntersecting && !noPlay;

  const isIntesectingForShowing = useIsIntersecting(ref, observeIntersectionForShowing);

  const {
    isContextMenuOpen, contextMenuPosition,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);
  const shouldRenderContextMenu = Boolean(!noContextMenu && contextMenuPosition);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!.closest('.custom-scroll, .no-scrollbar'));
  const getMenuElement = useLastCallback(() => {
    return isStatusPicker ? menuRef.current : ref.current!.querySelector('.sticker-context-menu .bubble');
  });

  const getLayout = () => ({ withPortal: isStatusPicker, shouldAvoidNegativePosition: true });

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

  useEffect(() => {
    if (isContextMenuOpen) {
      onContextMenuOpen?.();
    } else {
      onContextMenuClose?.();
    }
  }, [isContextMenuOpen, onContextMenuClose, onContextMenuOpen]);

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

  const handleRemoveClick = useLastCallback((e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();
    e.preventDefault();

    onRemoveRecentClick!(sticker);
  });

  const handleContextRemoveRecent = useLastCallback(() => {
    onRemoveRecentClick!(sticker);
  });

  const handleContextUnfave = useLastCallback(() => {
    onUnfaveClick!(sticker);
  });

  const handleContextFave = useLastCallback(() => {
    onFaveClick!(sticker);
  });

  const handleSendQuiet = useLastCallback(() => {
    onClick?.(clickArg, true);
  });

  const handleSendScheduled = useLastCallback(() => {
    onClick?.(clickArg, undefined, true);
  });

  const handleOpenSet = useLastCallback(() => {
    openStickerSet({ stickerSetInfo });
  });

  const handleEmojiStatusExpiresClick = useLastCallback((e: React.SyntheticEvent, duration = 0) => {
    e.preventDefault();
    e.stopPropagation();

    handleContextMenuClose();
    onContextMenuClick?.();
    setEmojiStatus({
      emojiStatus: sticker,
      expires: Date.now() / 1000 + duration + getServerTimeOffset(),
    });
  });

  const shouldShowCloseButton = !IS_TOUCH_ENV && onRemoveRecentClick;

  const fullClassName = buildClassName(
    'StickerButton',
    onClick && 'interactive',
    isSelected && 'selected',
    isCustomEmoji && 'custom-emoji',
    className,
  );

  const contextMenuItems = useMemo(() => {
    if (!shouldRenderContextMenu || noContextMenu || (isCustomEmoji && !isStatusPicker)) return [];

    const items: ReactNode[] = [];

    if (isCustomEmoji) {
      contentForStatusMenuContext.forEach((item) => {
        items.push(
          <MenuItem onClick={handleEmojiStatusExpiresClick} clickArg={item.arg}>
            {lang(item.title, item.value, 'i')}
          </MenuItem>,
        );
      });

      return items;
    }

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
    shouldRenderContextMenu, noContextMenu, isCustomEmoji, isStatusPicker, onUnfaveClick, onFaveClick, isLocked,
    onClick, canViewSet, onRemoveRecentClick, handleEmojiStatusExpiresClick, lang, handleContextUnfave,
    handleContextFave, isSavedMessages, handleSendScheduled, handleSendQuiet, handleOpenSet, handleContextRemoveRecent,
  ]);

  return (
    <div
      ref={ref}
      className={fullClassName}
      title={title || (sticker?.emoji)}
      data-sticker-id={id}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {isIntesectingForShowing && (
        <StickerView
          containerRef={ref}
          sticker={sticker}
          isSmall
          size={size}
          shouldLoop
          shouldPreloadPreview
          noLoad={!shouldLoad}
          noPlay={!shouldPlay}
          withSharedAnimation
          sharedCanvasRef={sharedCanvasRef}
          withTranslucentThumb={withTranslucentThumb}
          customColor={customColor}
        />
      )}
      {!noShowPremium && isLocked && (
        <div
          className="sticker-locked"
        >
          <i className="icon icon-lock-badge" />
        </div>
      )}
      {!noShowPremium && isPremium && !isLocked && (
        <div className="sticker-premium">
          <i className="icon icon-premium" />
        </div>
      )}
      {shouldShowCloseButton && (
        <Button
          className="sticker-remove-button"
          color="dark"
          round
          noFastClick
          onClick={handleRemoveClick}
        >
          <i className="icon icon-close" />
        </Button>
      )}
      {Boolean(contextMenuItems.length) && (
        <Menu
          ref={menuRef}
          isOpen={isContextMenuOpen}
          transformOriginX={transformOriginX}
          transformOriginY={transformOriginY}
          positionX={positionX}
          positionY={positionY}
          style={menuStyle}
          className="sticker-context-menu"
          autoClose
          withPortal={isStatusPicker}
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
