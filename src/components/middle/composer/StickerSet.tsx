import React, { FC, memo, useRef } from '../../../lib/teact/teact';

import { ApiSticker } from '../../../api/types';
import { StickerSetOrRecent } from '../../../types';
import { ObserveFn, useOnIntersect } from '../../../hooks/useIntersectionObserver';

import { STICKER_SIZE_PICKER } from '../../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import windowSize from '../../../util/windowSize';
import StickerButton from '../../common/StickerButton';
import useShowTransition from '../../../hooks/useShowTransition';
import buildClassName from '../../../util/buildClassName';

type OwnProps = {
  stickerSet: StickerSetOrRecent;
  loadAndPlay: boolean;
  index: number;
  observeIntersection: ObserveFn;
  shouldRender: boolean;
  onStickerSelect: (sticker: ApiSticker) => void;
  onStickerUnfave: (sticker: ApiSticker) => void;
};

const STICKERS_PER_ROW_ON_DESKTOP = 5;
const STICKER_MARGIN = IS_SINGLE_COLUMN_LAYOUT ? 8 : 16;
const MOBILE_CONTAINER_PADDING = 8;

const StickerSet: FC<OwnProps> = ({
  stickerSet,
  loadAndPlay,
  index,
  observeIntersection,
  shouldRender,
  onStickerSelect,
  onStickerUnfave,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  useOnIntersect(ref, observeIntersection);

  const { transitionClassNames } = useShowTransition(shouldRender, undefined, undefined, 'slow');

  const stickersPerRow = IS_SINGLE_COLUMN_LAYOUT
    ? Math.floor((windowSize.get().width - MOBILE_CONTAINER_PADDING) / (STICKER_SIZE_PICKER + STICKER_MARGIN))
    : STICKERS_PER_ROW_ON_DESKTOP;
  const height = Math.ceil(stickerSet.count / stickersPerRow) * (STICKER_SIZE_PICKER + STICKER_MARGIN);

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
        // @ts-ignore
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
            onUnfaveClick={stickerSet.id === 'favorite' ? onStickerUnfave : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(StickerSet);
