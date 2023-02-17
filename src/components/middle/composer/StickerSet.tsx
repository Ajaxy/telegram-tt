import React, {
  memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiSticker } from '../../../api/types';
import type { StickerSetOrRecent } from '../../../types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import {
  DEFAULT_STATUS_ICON_ID,
  DEFAULT_TOPIC_ICON_STICKER_ID,
  EMOJI_SIZE_PICKER, FAVORITE_SYMBOL_SET_ID, RECENT_SYMBOL_SET_ID, STICKER_SIZE_PICKER,
} from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { selectIsAlwaysHighPriorityEmoji, selectIsSetPremium } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useResizeObserver from '../../../hooks/useResizeObserver';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useAppLayout from '../../../hooks/useAppLayout';

import StickerButton from '../../common/StickerButton';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Button from '../../ui/Button';

import grey from '../../../assets/icons/forumTopic/grey.svg';

type OwnProps = {
  stickerSet: StickerSetOrRecent;
  loadAndPlay: boolean;
  index: number;
  idPrefix?: string;
  shouldRender: boolean;
  favoriteStickers?: ApiSticker[];
  isSavedMessages?: boolean;
  isStatusPicker?: boolean;
  isCurrentUserPremium?: boolean;
  shouldHideRecentHeader?: boolean;
  withDefaultTopicIcon?: boolean;
  withDefaultStatusIcon?: boolean;
  observeIntersection: ObserveFn;
  onStickerSelect?: (sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => void;
  onStickerUnfave?: (sticker: ApiSticker) => void;
  onStickerFave?: (sticker: ApiSticker) => void;
  onStickerRemoveRecent?: (sticker: ApiSticker) => void;
  onContextMenuOpen?: NoneToVoidFunction;
  onContextMenuClose?: NoneToVoidFunction;
  onContextMenuClick?: NoneToVoidFunction;
};

const ITEMS_PER_ROW_FALLBACK = 8;

const StickerSet: FC<OwnProps> = ({
  stickerSet,
  loadAndPlay,
  index,
  idPrefix,
  shouldRender,
  favoriteStickers,
  isSavedMessages,
  isStatusPicker,
  isCurrentUserPremium,
  shouldHideRecentHeader,
  withDefaultTopicIcon,
  withDefaultStatusIcon,
  observeIntersection,
  onStickerSelect,
  onStickerUnfave,
  onStickerFave,
  onStickerRemoveRecent,
  onContextMenuOpen,
  onContextMenuClose,
  onContextMenuClick,
}) => {
  const {
    clearRecentStickers,
    clearRecentCustomEmoji,
    openPremiumModal,
    toggleStickerSet,
    loadStickers,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);

  const lang = useLang();
  const [isConfirmModalOpen, openConfirmModal, closeConfirmModal] = useFlag();
  const { isMobile } = useAppLayout();

  const [itemsPerRow, setItemsPerRow] = useState(ITEMS_PER_ROW_FALLBACK);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const transitionClassNames = useMediaTransition(shouldRender);

  const stickerMarginPx = isMobile ? 8 : 16;
  const emojiMarginPx = isMobile ? 8 : 10;
  const isRecent = stickerSet.id === RECENT_SYMBOL_SET_ID;
  const isFavorite = stickerSet.id === FAVORITE_SYMBOL_SET_ID;
  const isEmoji = stickerSet.isEmoji;
  const isPremiumSet = !isRecent && selectIsSetPremium(stickerSet);

  const handleClearRecent = useCallback(() => {
    if (isEmoji) {
      clearRecentCustomEmoji();
    } else {
      clearRecentStickers();
    }
    closeConfirmModal();
  }, [clearRecentCustomEmoji, clearRecentStickers, closeConfirmModal, isEmoji]);

  const handleAddClick = useCallback(() => {
    if (isPremiumSet && !isCurrentUserPremium) {
      openPremiumModal({
        initialSection: 'animated_emoji',
      });
    } else {
      toggleStickerSet({
        stickerSetId: stickerSet.id,
      });
    }
  }, [isCurrentUserPremium, isPremiumSet, openPremiumModal, stickerSet, toggleStickerSet]);

  const handleDefaultTopicIconClick = useCallback(() => {
    onStickerSelect?.({
      id: DEFAULT_TOPIC_ICON_STICKER_ID,
      isLottie: false,
      isVideo: false,
      stickerSetInfo: {
        shortName: 'dummy',
      },
    } satisfies ApiSticker);
  }, [onStickerSelect]);

  const handleDefaultStatusIconClick = useCallback(() => {
    onStickerSelect?.({
      id: DEFAULT_STATUS_ICON_ID,
      isLottie: false,
      isVideo: false,
      stickerSetInfo: {
        shortName: 'dummy',
      },
    } satisfies ApiSticker);
  }, [onStickerSelect]);

  const itemSize = isEmoji ? EMOJI_SIZE_PICKER : STICKER_SIZE_PICKER;
  const margin = isEmoji ? emojiMarginPx : stickerMarginPx;

  const calculateItemsPerRow = useCallback((width: number) => {
    if (!width) return ITEMS_PER_ROW_FALLBACK;

    return Math.floor(width / (itemSize + margin));
  }, [itemSize, margin]);

  const handleResize = useCallback((entry: ResizeObserverEntry) => {
    setItemsPerRow(calculateItemsPerRow(entry.contentRect.width));
  }, [calculateItemsPerRow]);
  useResizeObserver(ref, handleResize);

  useLayoutEffect(() => {
    if (!ref.current) return;
    setItemsPerRow(calculateItemsPerRow(ref.current.clientWidth));
  }, [calculateItemsPerRow]);

  useEffect(() => {
    if (isIntersecting && !stickerSet.stickers?.length && stickerSet.accessHash) {
      loadStickers({
        stickerSetInfo: {
          id: stickerSet.id,
          accessHash: stickerSet.accessHash,
        },
      });
    }
  }, [isIntersecting, loadStickers, stickerSet]);

  const isLocked = !isSavedMessages && !isRecent && isEmoji && !isCurrentUserPremium
    && stickerSet.stickers?.some(({ isFree }) => !isFree);

  const isInstalled = stickerSet.installedDate && !stickerSet.isArchived;
  const canCut = !isInstalled && stickerSet.id !== RECENT_SYMBOL_SET_ID;
  const [isCut, , expand] = useFlag(canCut);
  const itemsBeforeCutout = itemsPerRow * 3 - 1;
  const totalItemsCount = withDefaultTopicIcon ? stickerSet.count + 1 : stickerSet.count;

  const heightWhenCut = Math.ceil(Math.min(itemsBeforeCutout, totalItemsCount) / itemsPerRow) * (itemSize + margin);
  const height = isCut ? heightWhenCut : Math.ceil(totalItemsCount / itemsPerRow) * (itemSize + margin);

  const shouldHideHeader = isRecent && shouldHideRecentHeader;

  const favoriteStickerIdsSet = useMemo(() => (
    favoriteStickers ? new Set(favoriteStickers.map(({ id }) => id)) : undefined
  ), [favoriteStickers]);

  return (
    <div
      ref={ref}
      key={stickerSet.id}
      id={`${idPrefix || 'sticker-set'}-${index}`}
      className={
        buildClassName('symbol-set', isLocked && 'symbol-set-locked')
      }
    >
      {!shouldHideHeader && (
        <div className="symbol-set-header">
          <p className="symbol-set-name">
            {isLocked && <i className="symbol-set-locked-icon icon-lock-badge" />}
            {stickerSet.title}
          </p>
          {isRecent && (
            <i className="symbol-set-remove icon-close" onClick={openConfirmModal} />
          )}
          {!isRecent && isEmoji && !isInstalled && (
            <Button
              className="symbol-set-add-button"
              withPremiumGradient={isPremiumSet && !isCurrentUserPremium}
              onClick={handleAddClick}
              pill
              size="tiny"
              fluid
            >
              {isPremiumSet && isLocked ? lang('Unlock') : lang('Add')}
            </Button>
          )}
        </div>
      )}
      <div
        className={buildClassName('symbol-set-container shared-canvas-container', transitionClassNames)}
        style={`height: ${height}px;`}
      >
        <canvas
          ref={sharedCanvasRef}
          className="shared-canvas"
          style={canCut ? `height: ${heightWhenCut}px;` : undefined}
        />
        {(isRecent || isFavorite || canCut) && <canvas ref={sharedCanvasHqRef} className="shared-canvas" />}
        {withDefaultTopicIcon && (
          <Button
            className="StickerButton custom-emoji"
            color="translucent"
            onClick={handleDefaultTopicIconClick}
            key="default-topic-icon"
          >
            <img src={grey} alt="Reset" />
          </Button>
        )}
        {withDefaultStatusIcon && (
          <Button
            className="StickerButton custom-emoji status-default"
            color="translucent"
            onClick={handleDefaultStatusIconClick}
            key="default-status-icon"
          >
            <i className="icon-premium" />
          </Button>
        )}
        {shouldRender && stickerSet.stickers && stickerSet.stickers
          .slice(0, isCut ? itemsBeforeCutout : stickerSet.stickers.length)
          .map((sticker, i) => {
            const isHqEmoji = (isRecent || isFavorite)
              && selectIsAlwaysHighPriorityEmoji(getGlobal(), sticker.stickerSetInfo);
            const canvasRef = (canCut && i >= itemsBeforeCutout) || isHqEmoji
              ? sharedCanvasHqRef
              : sharedCanvasRef;

            return (
              <StickerButton
                key={sticker.id}
                sticker={sticker}
                size={itemSize}
                observeIntersection={observeIntersection}
                noAnimate={!loadAndPlay}
                isSavedMessages={isSavedMessages}
                isStatusPicker={isStatusPicker}
                canViewSet
                isCurrentUserPremium={isCurrentUserPremium}
                sharedCanvasRef={canvasRef}
                onClick={onStickerSelect}
                clickArg={sticker}
                onUnfaveClick={isFavorite && favoriteStickerIdsSet?.has(sticker.id) ? onStickerUnfave : undefined}
                onFaveClick={!favoriteStickerIdsSet?.has(sticker.id) ? onStickerFave : undefined}
                onRemoveRecentClick={isRecent ? onStickerRemoveRecent : undefined}
                onContextMenuOpen={onContextMenuOpen}
                onContextMenuClose={onContextMenuClose}
                onContextMenuClick={onContextMenuClick}
              />
            );
          })}
        {isCut && totalItemsCount > itemsBeforeCutout && (
          <Button
            className="StickerButton custom-emoji set-expand"
            round
            color="translucent"
            onClick={expand}
            key="more"
          >
            +{totalItemsCount - itemsBeforeCutout}
          </Button>
        )}
      </div>

      {isRecent && (
        <ConfirmDialog
          text={lang('ClearRecentStickersAlertMessage')}
          isOpen={isConfirmModalOpen}
          onClose={closeConfirmModal}
          confirmHandler={handleClearRecent}
          confirmIsDestructive
        />
      )}
    </div>
  );
};

export default memo(StickerSet);
