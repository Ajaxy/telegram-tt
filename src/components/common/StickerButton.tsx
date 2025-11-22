import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type {
  ElementRef } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiBotInlineMediaResult, ApiSticker } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { getServerTime } from '../../util/serverTime';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import useDynamicColorListener from '../../hooks/stickers/useDynamicColorListener';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import Icon from './icons/Icon';
import StickerView from './StickerView';

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
  shouldIgnorePremium?: boolean;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  withTranslucentThumb?: boolean;
  forcePlayback?: boolean;
  isEffectEmoji?: boolean;
  noShowPremium?: boolean;
  noIcons?: boolean;
  clickArg: T;
  onClick?: (arg: OwnProps<T>['clickArg'], isSilent?: boolean, shouldSchedule?: boolean) => void;
  observeIntersection: ObserveFn;
  observeIntersectionForShowing?: ObserveFn;
  onFaveClick?: (sticker: ApiSticker) => void;
  onUnfaveClick?: (sticker: ApiSticker) => void;
  onRemoveRecentClick?: (sticker: ApiSticker) => void;
  onDismiss?: NoneToVoidFunction;
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
  isSelected,
  isCurrentUserPremium,
  shouldIgnorePremium,
  noShowPremium,
  sharedCanvasRef,
  withTranslucentThumb,
  forcePlayback,
  isEffectEmoji,
  noIcons,
  clickArg,
  onClick,
  observeIntersection,
  observeIntersectionForShowing,
  onFaveClick,
  onUnfaveClick,
  onRemoveRecentClick,
  onDismiss,
}: OwnProps<T>) => {
  const { openStickerSet, openPremiumModal, setEmojiStatus } = getActions();
  const ref = useRef<HTMLDivElement>();
  const menuRef = useRef<HTMLDivElement>();
  const lang = useOldLang();
  const hasCustomColor = sticker.shouldUseTextColor;
  const customColor = useDynamicColorListener(ref, undefined, !hasCustomColor);

  const {
    id, stickerSetInfo,
  } = sticker;

  const isPremium = !sticker.isFree || sticker.hasEffect;
  const isCustomEmoji = sticker.isCustomEmoji || isEffectEmoji;
  const isPremiumSticker = !isCustomEmoji && isPremium;
  const isLocked = !isCurrentUserPremium && isPremium && !shouldIgnorePremium;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const shouldLoad = isIntersecting;
  const shouldPlay = isIntersecting && !noPlay;

  const isIntesectingForShowing = useIsIntersecting(ref, observeIntersectionForShowing);

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);
  const shouldRenderContextMenu = Boolean(!noContextMenu && contextMenuAnchor);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!.closest('.custom-scroll, .no-scrollbar'));
  const getMenuElement = useLastCallback(() => {
    return isStatusPicker ? menuRef.current : ref.current!.querySelector('.sticker-context-menu .bubble');
  });
  const getLayout = useLastCallback(() => ({ withPortal: isStatusPicker, shouldAvoidNegativePosition: true }));

  useEffect(() => {
    if (!isIntersecting) handleContextMenuClose();
  }, [handleContextMenuClose, isIntersecting]);

  const handleClick = () => {
    if (isContextMenuOpen) return;
    if (isLocked) {
      if (isEffectEmoji) {
        openPremiumModal({ initialSection: 'effects' });
      } else if (isCustomEmoji) {
        openPremiumModal({ initialSection: 'animated_emoji' });
      } else {
        openPremiumModal({ initialSection: 'premium_stickers' });
      }
      onDismiss?.();
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
    onDismiss?.();
    setEmojiStatus({
      emojiStatus: { type: 'regular', documentId: sticker.id, until: getServerTime() + duration },
    });
  });

  const shouldShowCloseButton = !IS_TOUCH_ENV && onRemoveRecentClick;

  const fullClassName = buildClassName(
    'StickerButton',
    onClick && 'interactive',
    isSelected && 'selected',
    isCustomEmoji && 'custom-emoji',
    isEffectEmoji && 'effect-emoji',
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
          noVideoOnMobile
          withSharedAnimation
          sharedCanvasRef={sharedCanvasRef}
          withTranslucentThumb={withTranslucentThumb}
          customColor={customColor}
          forceAlways={forcePlayback}
        />
      )}
      {!noIcons && !noShowPremium && isLocked && (
        <div
          className="sticker-locked"
        >
          <Icon name="lock-badge" />
        </div>
      )}
      {!noIcons && !noShowPremium && isPremiumSticker && !isLocked && (
        <div className="sticker-premium">
          <Icon name="star" />
        </div>
      )}
      {shouldShowCloseButton && (
        <Button
          className="sticker-remove-button"
          color="dark"
          round
          noFastClick
          onClick={handleRemoveClick}
          iconName="close"
        />
      )}
      {Boolean(contextMenuItems.length) && (
        <Menu
          ref={menuRef}
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
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
