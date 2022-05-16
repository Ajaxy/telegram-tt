import React, {
  FC, memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import { ApiSticker } from '../../../api/types';
import { StickerSetOrRecent } from '../../../types';
import { ObserveFn, useOnIntersect } from '../../../hooks/useIntersectionObserver';

import { FAVORITE_SYMBOL_SET_ID, RECENT_SYMBOL_SET_ID, STICKER_SIZE_PICKER } from '../../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import windowSize from '../../../util/windowSize';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import useMediaTransition from '../../../hooks/useMediaTransition';

import StickerButton from '../../common/StickerButton';
import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  stickerSet: StickerSetOrRecent;
  loadAndPlay: boolean;
  index: number;
  shouldRender: boolean;
  favoriteStickers?: ApiSticker[];
  isSavedMessages?: boolean;
  observeIntersection: ObserveFn;
  onStickerSelect: (sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => void;
  onStickerUnfave: (sticker: ApiSticker) => void;
  onStickerFave: (sticker: ApiSticker) => void;
  onStickerRemoveRecent: (sticker: ApiSticker) => void;
};

const STICKERS_PER_ROW_ON_DESKTOP = 5;
const STICKER_MARGIN = IS_SINGLE_COLUMN_LAYOUT ? 8 : 16;
const MOBILE_CONTAINER_PADDING = 8;

const StickerSet: FC<OwnProps> = ({
  stickerSet,
  loadAndPlay,
  index,
  shouldRender,
  favoriteStickers,
  isSavedMessages,
  observeIntersection,
  onStickerSelect,
  onStickerUnfave,
  onStickerFave,
  onStickerRemoveRecent,
}) => {
  const { clearRecentStickers } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const [isConfirmModalOpen, openConfirmModal, closeConfirmModal] = useFlag();
  const lang = useLang();

  useOnIntersect(ref, observeIntersection);

  const transitionClassNames = useMediaTransition(shouldRender);

  const handleClearRecent = useCallback(() => {
    clearRecentStickers();
    closeConfirmModal();
  }, [clearRecentStickers, closeConfirmModal]);

  const stickersPerRow = IS_SINGLE_COLUMN_LAYOUT
    ? Math.floor((windowSize.get().width - MOBILE_CONTAINER_PADDING) / (STICKER_SIZE_PICKER + STICKER_MARGIN))
    : STICKERS_PER_ROW_ON_DESKTOP;
  const height = Math.ceil(stickerSet.count / stickersPerRow) * (STICKER_SIZE_PICKER + STICKER_MARGIN);

  const favoriteStickerIdsSet = useMemo(() => (
    favoriteStickers ? new Set(favoriteStickers.map(({ id }) => id)) : undefined
  ), [favoriteStickers]);

  const isRecent = stickerSet.id === RECENT_SYMBOL_SET_ID;

  return (
    <div
      ref={ref}
      key={stickerSet.id}
      id={`sticker-set-${index}`}
      className="symbol-set"
    >
      <div className="symbol-set-header">
        <p className="symbol-set-name">{stickerSet.title}</p>
        {isRecent && (
          <i className="symbol-set-remove icon-close" onClick={openConfirmModal} />
        )}
      </div>
      <div
        className={buildClassName('symbol-set-container', transitionClassNames)}
        style={`height: ${height}px;`}
      >
        {shouldRender && stickerSet.stickers && stickerSet.stickers.map((sticker) => (
          <StickerButton
            key={sticker.id}
            sticker={sticker}
            size={STICKER_SIZE_PICKER}
            observeIntersection={observeIntersection}
            noAnimate={!loadAndPlay}
            onClick={onStickerSelect}
            clickArg={sticker}
            onUnfaveClick={stickerSet.id === FAVORITE_SYMBOL_SET_ID && favoriteStickerIdsSet?.has(sticker.id)
              ? onStickerUnfave : undefined}
            onFaveClick={!favoriteStickerIdsSet?.has(sticker.id) ? onStickerFave : undefined}
            onRemoveRecentClick={isRecent ? onStickerRemoveRecent : undefined}
            isSavedMessages={isSavedMessages}
            canViewSet
          />
        ))}
      </div>

      {isRecent && (
        <ConfirmDialog
          text={lang('ClearRecentEmoji')}
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
