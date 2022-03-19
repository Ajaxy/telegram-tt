import React, {
  FC, memo, useMemo, useRef,
} from '../../../lib/teact/teact';

import { ApiSticker } from '../../../api/types';
import { StickerSetOrRecent } from '../../../types';
import { ObserveFn, useOnIntersect } from '../../../hooks/useIntersectionObserver';

import { STICKER_SIZE_PICKER } from '../../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import windowSize from '../../../util/windowSize';
import buildClassName from '../../../util/buildClassName';

import useMediaTransition from '../../../hooks/useMediaTransition';

import StickerButton from '../../common/StickerButton';

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
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  useOnIntersect(ref, observeIntersection);

  const transitionClassNames = useMediaTransition(shouldRender);

  const stickersPerRow = IS_SINGLE_COLUMN_LAYOUT
    ? Math.floor((windowSize.get().width - MOBILE_CONTAINER_PADDING) / (STICKER_SIZE_PICKER + STICKER_MARGIN))
    : STICKERS_PER_ROW_ON_DESKTOP;
  const height = Math.ceil(stickerSet.count / stickersPerRow) * (STICKER_SIZE_PICKER + STICKER_MARGIN);

  const favoriteStickerIdsSet = useMemo(() => (
    favoriteStickers ? new Set(favoriteStickers.map(({ id }) => id)) : undefined
  ), [favoriteStickers]);

  return (
    <div
      ref={ref}
      key={stickerSet.id}
      id={`sticker-set-${index}`}
      className="symbol-set"
    >
      <p className="symbol-set-name">{stickerSet.title}</p>
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
            onUnfaveClick={favoriteStickerIdsSet?.has(sticker.id) ? onStickerUnfave : undefined}
            onFaveClick={!favoriteStickerIdsSet?.has(sticker.id) ? onStickerFave : undefined}
            isSavedMessages={isSavedMessages}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(StickerSet);
