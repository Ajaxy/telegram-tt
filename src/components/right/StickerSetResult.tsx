import React, {
  FC, useEffect, memo, useMemo, useCallback,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ApiStickerSet } from '../../api/types';
import { ObserveFn } from '../../hooks/useIntersectionObserver';

import { STICKER_SIZE_SEARCH } from '../../config';
import { selectShouldLoopStickers, selectStickerSet } from '../../global/selectors';
import useFlag from '../../hooks/useFlag';
import useOnChange from '../../hooks/useOnChange';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import StickerButton from '../common/StickerButton';
import StickerSetModal from '../common/StickerSetModal.async';
import Spinner from '../ui/Spinner';

type OwnProps = {
  stickerSetId: string;
  observeIntersection: ObserveFn;
  isSomeModalOpen: boolean;
  onModalToggle: (isOpen: boolean) => void;
};

type StateProps = {
  set?: ApiStickerSet;
  shouldPlay?: boolean;
};

const STICKERS_TO_DISPLAY = 5;

const StickerSetResult: FC<OwnProps & StateProps> = ({
  stickerSetId, observeIntersection, set, shouldPlay,
  isSomeModalOpen, onModalToggle,
}) => {
  const { loadStickers, toggleStickerSet } = getActions();

  const lang = useLang();
  const isAdded = set && Boolean(set.installedDate);
  const areStickersLoaded = Boolean(set?.stickers);

  const [isModalOpen, openModal, closeModal] = useFlag();

  useOnChange(() => {
    onModalToggle(isModalOpen);
  }, [isModalOpen, onModalToggle]);

  const displayedStickers = useMemo(() => {
    if (!set) {
      return [];
    }

    const coverStickerIds = (set.covers || []).map(({ id }) => id);
    const otherStickers = set.stickers ? set.stickers.filter(({ id }) => !coverStickerIds.includes(id)) : [];

    return [...(set.covers || []), ...otherStickers].slice(0, STICKERS_TO_DISPLAY);
  }, [set]);

  useEffect(() => {
    // Featured stickers are initialized with one sticker in collection (cover of SickerSet)
    if (!areStickersLoaded && displayedStickers.length < STICKERS_TO_DISPLAY) {
      loadStickers({ stickerSetId });
    }
  }, [areStickersLoaded, displayedStickers.length, loadStickers, stickerSetId]);

  const handleAddClick = useCallback(() => {
    toggleStickerSet({ stickerSetId });
  }, [toggleStickerSet, stickerSetId]);

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
      <div className="sticker-set-main">
        {!canRenderStickers && <Spinner />}
        {canRenderStickers && displayedStickers.map((sticker) => (
          <StickerButton
            sticker={sticker}
            size={STICKER_SIZE_SEARCH}
            observeIntersection={observeIntersection}
            noAnimate={!shouldPlay || isModalOpen || isSomeModalOpen}
            clickArg={undefined}
            onClick={openModal}
            noContextMenu
          />
        ))}
      </div>
      {canRenderStickers && (
        <StickerSetModal
          isOpen={isModalOpen}
          fromSticker={displayedStickers[0]}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { stickerSetId }): StateProps => {
    return {
      set: selectStickerSet(global, stickerSetId),
      shouldPlay: selectShouldLoopStickers(global),
    };
  },
)(StickerSetResult));
