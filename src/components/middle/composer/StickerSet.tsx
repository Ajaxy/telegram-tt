import React, {
  memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiSticker } from '../../../api/types';
import type { StickerSetOrRecent } from '../../../types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { useOnIntersect } from '../../../hooks/useIntersectionObserver';

import {
  EMOJI_SIZE_PICKER, FAVORITE_SYMBOL_SET_ID, RECENT_SYMBOL_SET_ID, STICKER_SIZE_PICKER,
} from '../../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import windowSize from '../../../util/windowSize';
import buildClassName from '../../../util/buildClassName';
import { selectIsAlwaysHighPriorityEmoji, selectIsSetPremium } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import useMediaTransition from '../../../hooks/useMediaTransition';

import StickerButton from '../../common/StickerButton';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Button from '../../ui/Button';

type OwnProps = {
  stickerSet: StickerSetOrRecent;
  loadAndPlay: boolean;
  index: number;
  shouldRender: boolean;
  favoriteStickers?: ApiSticker[];
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  isCustomEmojiPicker?: boolean;
  observeIntersection: ObserveFn;
  onStickerSelect?: (sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => void;
  onStickerUnfave?: (sticker: ApiSticker) => void;
  onStickerFave?: (sticker: ApiSticker) => void;
  onStickerRemoveRecent?: (sticker: ApiSticker) => void;
};

const STICKERS_PER_ROW_ON_DESKTOP = 5;
const EMOJI_PER_ROW_ON_DESKTOP = 8;
const STICKER_MARGIN = IS_SINGLE_COLUMN_LAYOUT ? 8 : 16;
const EMOJI_MARGIN = IS_SINGLE_COLUMN_LAYOUT ? 8 : 10;
const MOBILE_CONTAINER_PADDING = 8;

const StickerSet: FC<OwnProps> = ({
  stickerSet,
  loadAndPlay,
  index,
  shouldRender,
  favoriteStickers,
  isSavedMessages,
  isCurrentUserPremium,
  isCustomEmojiPicker,
  observeIntersection,
  onStickerSelect,
  onStickerUnfave,
  onStickerFave,
  onStickerRemoveRecent,
}) => {
  const {
    clearRecentStickers,
    clearRecentCustomEmoji,
    openPremiumModal,
    toggleStickerSet,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvas2Ref = useRef<HTMLCanvasElement>(null);

  const [isConfirmModalOpen, openConfirmModal, closeConfirmModal] = useFlag();
  const lang = useLang();

  useOnIntersect(ref, observeIntersection);

  const transitionClassNames = useMediaTransition(shouldRender);

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

  const isLocked = !isSavedMessages && !isRecent && isEmoji && !isCurrentUserPremium
    && stickerSet.stickers?.some((l) => !l.isFree);
  const itemSize = isEmoji ? EMOJI_SIZE_PICKER : STICKER_SIZE_PICKER;
  const itemsPerRow = isEmoji ? EMOJI_PER_ROW_ON_DESKTOP : STICKERS_PER_ROW_ON_DESKTOP;
  const margin = isEmoji ? EMOJI_MARGIN : STICKER_MARGIN;

  const stickersPerRow = IS_SINGLE_COLUMN_LAYOUT
    ? Math.floor((windowSize.get().width - MOBILE_CONTAINER_PADDING) / (itemSize + margin))
    : itemsPerRow;

  const canCut = !stickerSet.installedDate && stickerSet.id !== RECENT_SYMBOL_SET_ID;
  const [isCut, , expand] = useFlag(canCut);
  const itemsBeforeCutout = stickersPerRow * 3 - 1;
  const heightWhenCut = Math.ceil(Math.min(itemsBeforeCutout, stickerSet.count) / stickersPerRow) * (itemSize + margin);
  const height = isCut ? heightWhenCut : Math.ceil(stickerSet.count / stickersPerRow) * (itemSize + margin);

  const favoriteStickerIdsSet = useMemo(() => (
    favoriteStickers ? new Set(favoriteStickers.map(({ id }) => id)) : undefined
  ), [favoriteStickers]);

  return (
    <div
      ref={ref}
      key={stickerSet.id}
      id={`${isCustomEmojiPicker ? 'custom-emoji-set' : 'sticker-set'}-${index}`}
      className={
        buildClassName('symbol-set', isLocked && 'symbol-set-locked')
      }
    >
      <div className="symbol-set-header">
        <p className="symbol-set-name">
          {isLocked && <i className="symbol-set-locked-icon icon-lock-badge" />}
          {stickerSet.title}
        </p>
        {isRecent && (
          <i className="symbol-set-remove icon-close" onClick={openConfirmModal} />
        )}
        {!isRecent && isEmoji && !stickerSet.installedDate && (
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
      <div
        className={buildClassName('symbol-set-container shared-canvas-container', transitionClassNames)}
        style={`height: ${height}px;`}
      >
        <canvas
          ref={sharedCanvasRef}
          className="shared-canvas"
          style={canCut ? `height: ${heightWhenCut}px;` : undefined}
        />
        {(isRecent || isFavorite || canCut) && <canvas ref={sharedCanvas2Ref} className="shared-canvas" />}
        {shouldRender && stickerSet.stickers && stickerSet.stickers
          .slice(0, isCut ? itemsBeforeCutout : stickerSet.stickers.length)
          .map((sticker, i) => {
            const isHqEmoji = (isRecent || isFavorite)
              && selectIsAlwaysHighPriorityEmoji(getGlobal(), sticker.stickerSetInfo);
            const canvasRef = (canCut && i >= itemsBeforeCutout) || isHqEmoji
              ? sharedCanvas2Ref
              : sharedCanvasRef;

            return (
              <StickerButton
                key={sticker.id}
                sticker={sticker}
                size={itemSize}
                observeIntersection={observeIntersection}
                noAnimate={!loadAndPlay}
                isSavedMessages={isSavedMessages}
                canViewSet
                isCurrentUserPremium={isCurrentUserPremium}
                sharedCanvasRef={canvasRef}
                onClick={onStickerSelect}
                clickArg={sticker}
                onUnfaveClick={isFavorite && favoriteStickerIdsSet?.has(sticker.id) ? onStickerUnfave : undefined}
                onFaveClick={!favoriteStickerIdsSet?.has(sticker.id) ? onStickerFave : undefined}
                onRemoveRecentClick={isRecent ? onStickerRemoveRecent : undefined}
              />
            );
          })}
        {isCut && stickerSet.count > itemsBeforeCutout && (
          <Button className="StickerButton custom-emoji set-expand" round color="translucent" onClick={expand}>
            +{stickerSet.count - itemsBeforeCutout}
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
