import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiSticker, ApiStickerSet } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { STICKER_SIZE_SEARCH } from '../../config';
import { selectIsCurrentUserPremium, selectShouldLoopStickers, selectStickerSet } from '../../global/selectors';

import useOldLang from '../../hooks/useOldLang';

import StickerButton from '../common/StickerButton';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

type OwnProps = {
  stickerSetId: string;
  observeIntersection: ObserveFn;
  isModalOpen?: boolean;
};

type StateProps = {
  set?: ApiStickerSet;
  shouldPlay?: boolean;
  isCurrentUserPremium?: boolean;
};

const PREMIUM_STICKERS_TO_DISPLAY = 3;
const STICKERS_TO_DISPLAY = 5;

const StickerSetResult: FC<OwnProps & StateProps> = ({
  stickerSetId, observeIntersection, set, shouldPlay,
  isModalOpen, isCurrentUserPremium,
}) => {
  const { loadStickers, toggleStickerSet, openStickerSet } = getActions();

  const sharedCanvasRef = useRef<HTMLCanvasElement>();

  const lang = useOldLang();
  const isAdded = set && !set.isArchived && Boolean(set.installedDate);
  const areStickersLoaded = Boolean(set?.stickers);

  const displayedStickers = useMemo(() => {
    if (!set) {
      return [];
    }

    const premiumStickerIds = (set.stickers?.filter(({ hasEffect }) => hasEffect) ?? [])
      .slice(0, PREMIUM_STICKERS_TO_DISPLAY);
    const coverStickerIds = (set.covers || []).map(({ id }) => id);
    const otherStickers = set.stickers ? set.stickers.filter(({ id }) => !coverStickerIds.includes(id)) : [];

    return [...premiumStickerIds, ...(set.covers || []), ...otherStickers].slice(0, STICKERS_TO_DISPLAY);
  }, [set]);

  useEffect(() => {
    // Featured stickers are initialized with one sticker in collection (cover of SickerSet)
    if (!areStickersLoaded && displayedStickers.length < STICKERS_TO_DISPLAY && set) {
      loadStickers({
        stickerSetInfo: {
          shortName: set.shortName,
        },
      });
    }
  }, [areStickersLoaded, displayedStickers.length, loadStickers, set, stickerSetId]);

  const handleAddClick = useCallback(() => {
    toggleStickerSet({ stickerSetId });
  }, [toggleStickerSet, stickerSetId]);

  const handleStickerClick = useCallback((sticker: ApiSticker) => {
    openStickerSet({ stickerSetInfo: sticker.stickerSetInfo });
  }, [openStickerSet]);

  if (!set) {
    return undefined;
  }

  const canRenderStickers = displayedStickers.length > 0;

  return (
    <div key={set.id} className="sticker-set" dir={lang.isRtl ? 'rtl' : undefined}>
      <div className="sticker-set-header">
        <div className="title-wrapper">
          <h3 className="title" dir="auto">{set.title}</h3>
          <p className="count" dir="auto">{lang('Stickers', set.count, 'i')}</p>
        </div>
        <Button
          className={isAdded ? 'is-added' : undefined}
          color="primary"
          size="tiny"
          pill
          fluid
          onClick={handleAddClick}
        >
          {lang(isAdded ? 'Stickers.Installed' : 'Stickers.Install')}
        </Button>
      </div>
      <div className="sticker-set-main shared-canvas-container">
        <canvas ref={sharedCanvasRef} className="shared-canvas" />
        {!canRenderStickers && <Spinner />}
        {canRenderStickers && displayedStickers.map((sticker) => (
          <StickerButton
            sticker={sticker}
            size={STICKER_SIZE_SEARCH}
            observeIntersection={observeIntersection}
            noPlay={!shouldPlay || isModalOpen}
            clickArg={sticker}
            onClick={handleStickerClick}
            noContextMenu
            isCurrentUserPremium={isCurrentUserPremium}
            sharedCanvasRef={sharedCanvasRef}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { stickerSetId }): Complete<StateProps> => {
    return {
      set: selectStickerSet(global, stickerSetId),
      shouldPlay: selectShouldLoopStickers(global),
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(StickerSetResult));
