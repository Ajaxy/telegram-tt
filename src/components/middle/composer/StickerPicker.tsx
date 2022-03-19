import React, {
  FC, useState, useEffect, memo, useRef, useMemo, useCallback,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { ApiStickerSet, ApiSticker } from '../../../api/types';
import { StickerSetOrRecent } from '../../../types';

import { SLIDE_TRANSITION_DURATION, STICKER_SIZE_PICKER_HEADER } from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import fastSmoothScroll from '../../../util/fastSmoothScroll';
import buildClassName from '../../../util/buildClassName';
import fastSmoothScrollHorizontal from '../../../util/fastSmoothScrollHorizontal';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';
import useSendMessageAction from '../../../hooks/useSendMessageAction';

import Loading from '../../ui/Loading';
import Button from '../../ui/Button';
import StickerButton from '../../common/StickerButton';
import StickerSet from './StickerSet';
import StickerSetCover from './StickerSetCover';
import StickerSetCoverAnimated from './StickerSetCoverAnimated';

import './StickerPicker.scss';

type OwnProps = {
  chatId: string;
  threadId?: number;
  className: string;
  loadAndPlay: boolean;
  canSendStickers: boolean;
  onStickerSelect: (sticker: ApiSticker) => void;
};

type StateProps = {
  recentStickers: ApiSticker[];
  favoriteStickers: ApiSticker[];
  stickerSetsById: Record<string, ApiStickerSet>;
  addedSetIds?: string[];
  shouldPlay?: boolean;
};

const SMOOTH_SCROLL_DISTANCE = 500;
const HEADER_BUTTON_WIDTH = 52; // px (including margin)
const STICKER_INTERSECTION_THROTTLE = 200;

const stickerSetIntersections: boolean[] = [];

const StickerPicker: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  className,
  loadAndPlay,
  canSendStickers,
  recentStickers,
  favoriteStickers,
  addedSetIds,
  stickerSetsById,
  shouldPlay,
  onStickerSelect,
}) => {
  const {
    loadRecentStickers,
    addRecentSticker,
    unfaveSticker,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  const [activeSetIndex, setActiveSetIndex] = useState<number>(0);
  const sendMessageAction = useSendMessageAction(chatId, threadId);

  const { observe: observeIntersection } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: STICKER_INTERSECTION_THROTTLE,
  }, (entries) => {
    entries.forEach((entry) => {
      const { id } = entry.target as HTMLDivElement;
      if (!id || !id.startsWith('sticker-set-')) {
        return;
      }

      const index = Number(id.replace('sticker-set-', ''));
      stickerSetIntersections[index] = entry.isIntersecting;
    });

    const intersectingWithIndexes = stickerSetIntersections
      .map((isIntersecting, index) => ({ index, isIntersecting }))
      .filter(({ isIntersecting }) => isIntersecting);

    if (!intersectingWithIndexes.length) {
      return;
    }

    setActiveSetIndex(intersectingWithIndexes[Math.floor(intersectingWithIndexes.length / 2)].index);
  });
  const { observe: observeIntersectionForCovers } = useIntersectionObserver({ rootRef: headerRef });

  const lang = useLang();

  const areAddedLoaded = Boolean(addedSetIds);

  const allSets = useMemo(() => {
    if (!addedSetIds) {
      return MEMO_EMPTY_ARRAY;
    }

    return [
      {
        id: 'recent',
        title: lang('RecentStickers'),
        stickers: recentStickers,
        count: recentStickers.length,
      },
      {
        id: 'favorite',
        title: lang('FavoriteStickers'),
        stickers: favoriteStickers,
        count: favoriteStickers.length,
      },
      ...addedSetIds.map((id) => stickerSetsById[id]).filter(Boolean),
    ];
  }, [addedSetIds, lang, recentStickers, favoriteStickers, stickerSetsById]);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allSets.filter((set) => set.stickers?.length).length === 0
  ), [allSets, areAddedLoaded]);

  useEffect(() => {
    if (loadAndPlay) {
      loadRecentStickers();
      sendMessageAction({ type: 'chooseSticker' });
    }
  }, [loadAndPlay, loadRecentStickers, sendMessageAction]);

  useHorizontalScroll(headerRef.current);

  // Scroll container and header when active set changes
  useEffect(() => {
    if (!areAddedLoaded) {
      return;
    }

    const header = headerRef.current;
    if (!header) {
      return;
    }

    const newLeft = activeSetIndex * HEADER_BUTTON_WIDTH - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    fastSmoothScrollHorizontal(header, newLeft);
  }, [areAddedLoaded, activeSetIndex]);

  const selectStickerSet = useCallback((index: number) => {
    setActiveSetIndex(index);
    const stickerSetEl = document.getElementById(`sticker-set-${index}`)!;
    fastSmoothScroll(containerRef.current!, stickerSetEl, 'start', undefined, SMOOTH_SCROLL_DISTANCE);
  }, []);

  const handleStickerSelect = useCallback((sticker: ApiSticker) => {
    onStickerSelect(sticker);
    addRecentSticker({ sticker });
  }, [addRecentSticker, onStickerSelect]);

  const handleStickerUnfave = useCallback((sticker: ApiSticker) => {
    unfaveSticker({ sticker });
  }, [unfaveSticker]);

  const handleMouseMove = useCallback(() => {
    sendMessageAction({ type: 'chooseSticker' });
  }, [sendMessageAction]);

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);

  function renderCover(stickerSet: StickerSetOrRecent, index: number) {
    const firstSticker = stickerSet.stickers?.[0];
    const buttonClassName = buildClassName(
      'symbol-set-button sticker-set-button',
      index === activeSetIndex && 'activated',
    );

    if (stickerSet.id === 'recent' || stickerSet.id === 'favorite' || stickerSet.hasThumbnail || !firstSticker) {
      return (
        <Button
          key={stickerSet.id}
          className={buttonClassName}
          ariaLabel={stickerSet.title}
          round
          faded={stickerSet.id === 'recent' || stickerSet.id === 'favorite'}
          color="translucent"
          onClick={() => selectStickerSet(index)}
        >
          {stickerSet.id === 'recent' ? (
            <i className="icon-recent" />
          ) : stickerSet.id === 'favorite' ? (
            <i className="icon-favorite" />
          ) : stickerSet.isLottie ? (
            <StickerSetCoverAnimated
              stickerSet={stickerSet as ApiStickerSet}
              observeIntersection={observeIntersectionForCovers}
            />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              observeIntersection={observeIntersectionForCovers}
            />
          )}
        </Button>
      );
    } else {
      return (
        <StickerButton
          key={stickerSet.id}
          sticker={firstSticker}
          size={STICKER_SIZE_PICKER_HEADER}
          title={stickerSet.title}
          className={buttonClassName}
          observeIntersection={observeIntersectionForCovers}
          onClick={selectStickerSet}
          clickArg={index}
        />
      );
    }
  }

  const fullClassName = buildClassName('StickerPicker', className);

  if (!areAddedLoaded || !canRenderContents || noPopulatedSets || !canSendStickers) {
    return (
      <div className={fullClassName}>
        {!canSendStickers ? (
          <div className="picker-disabled">{lang('ErrorSendRestrictedStickersAll')}</div>
        ) : noPopulatedSets ? (
          <div className="picker-disabled">{lang('NoStickers')}</div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }

  return (
    <div className={fullClassName}>
      <div
        ref={headerRef}
        className="StickerPicker-header no-selection no-scrollbar"
      >
        {allSets.map(renderCover)}
      </div>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className={buildClassName('StickerPicker-main no-selection', IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
      >
        {allSets.map((stickerSet, i) => (
          <StickerSet
            key={stickerSet.id}
            stickerSet={stickerSet}
            loadAndPlay={Boolean(shouldPlay && loadAndPlay)}
            index={i}
            observeIntersection={observeIntersection}
            shouldRender={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
            onStickerSelect={handleStickerSelect}
            onStickerUnfave={handleStickerUnfave}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      setsById,
      added,
      recent,
      favorite,
    } = global.stickers;

    return {
      recentStickers: recent.stickers,
      favoriteStickers: favorite.stickers,
      stickerSetsById: setsById,
      addedSetIds: added.setIds,
      shouldPlay: global.settings.byKey.shouldLoopStickers,
    };
  },
)(StickerPicker));
