import type { FC } from '../../../lib/teact/teact';
import React, {
  useState, useEffect, memo, useRef, useMemo, useCallback,
} from '../../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../../global';

import type { ApiStickerSet, ApiSticker } from '../../../api/types';
import type { StickerSetOrRecent } from '../../../types';

import {
  CHAT_STICKER_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  PREMIUM_STICKER_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION, STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER_HEADER,
} from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import fastSmoothScroll from '../../../util/fastSmoothScroll';
import buildClassName from '../../../util/buildClassName';
import fastSmoothScrollHorizontal from '../../../util/fastSmoothScrollHorizontal';
import { pickTruthy, unique } from '../../../util/iteratees';
import {
  selectIsAlwaysHighPriorityEmoji,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
} from '../../../global/selectors';

import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';

import Loading from '../../ui/Loading';
import Button from '../../ui/Button';
import StickerButton from '../../common/StickerButton';
import StickerSet from './StickerSet';
import StickerSetCover from './StickerSetCover';

import './StickerPicker.scss';

type OwnProps = {
  chatId?: string;
  className?: string;
  loadAndPlay: boolean;
  withDefaultTopicIcons?: boolean;
  onCustomEmojiSelect: (sticker: ApiSticker) => void;
};

type StateProps = {
  stickerSetsById: Record<string, ApiStickerSet>;
  addedCustomEmojiIds?: string[];
  recentCustomEmoji: ApiSticker[];
  defaultTopicIconsId?: string;
  featuredCustomEmojiIds?: string[];
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
};

const SMOOTH_SCROLL_DISTANCE = 500;
const HEADER_BUTTON_WIDTH = 52; // px (including margin)
const STICKER_INTERSECTION_THROTTLE = 200;

const stickerSetIntersections: boolean[] = [];

const CustomEmojiPicker: FC<OwnProps & StateProps> = ({
  className,
  loadAndPlay,
  addedCustomEmojiIds,
  recentCustomEmoji,
  stickerSetsById,
  featuredCustomEmojiIds,
  canAnimate,
  isSavedMessages,
  isCurrentUserPremium,
  withDefaultTopicIcons,
  defaultTopicIconsId,
  onCustomEmojiSelect,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);

  const [activeSetIndex, setActiveSetIndex] = useState<number>(0);

  const { observe: observeIntersection } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: STICKER_INTERSECTION_THROTTLE,
  }, (entries) => {
    entries.forEach((entry) => {
      const { id } = entry.target as HTMLDivElement;
      if (!id || !id.startsWith('custom-emoji-set-')) {
        return;
      }

      const index = Number(id.replace('custom-emoji-set-', ''));
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

  const areAddedLoaded = Boolean(addedCustomEmojiIds);

  const allSets = useMemo(() => {
    if (!addedCustomEmojiIds) {
      return MEMO_EMPTY_ARRAY;
    }

    const defaultSets: StickerSetOrRecent[] = [];

    if (withDefaultTopicIcons) {
      const defaultTopicIconsPack = stickerSetsById[defaultTopicIconsId!];
      if (defaultTopicIconsPack.stickers?.length) {
        defaultSets.push({
          ...defaultTopicIconsPack,
          id: RECENT_SYMBOL_SET_ID,
          title: lang('RecentStickers'),
        });
      }
    } else if (recentCustomEmoji.length) {
      defaultSets.push({
        id: RECENT_SYMBOL_SET_ID,
        accessHash: '0',
        title: lang('RecentStickers'),
        stickers: recentCustomEmoji,
        count: recentCustomEmoji.length,
        isEmoji: true as true,
      });
    }

    const setIdsToDisplay = unique(addedCustomEmojiIds.concat(featuredCustomEmojiIds || []));

    const setsToDisplay = Object.values(pickTruthy(stickerSetsById, setIdsToDisplay));

    return [
      ...defaultSets,
      ...setsToDisplay,
    ];
  }, [
    addedCustomEmojiIds, defaultTopicIconsId, featuredCustomEmojiIds, lang, recentCustomEmoji, stickerSetsById,
    withDefaultTopicIcons,
  ]);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allSets.filter((set) => set.stickers?.length).length === 0
  ), [allSets, areAddedLoaded]);

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
    const stickerSetEl = document.getElementById(`custom-emoji-set-${index}`)!;
    fastSmoothScroll(containerRef.current!, stickerSetEl, 'start', undefined, SMOOTH_SCROLL_DISTANCE);
  }, []);

  const handleEmojiSelect = useCallback((emoji: ApiSticker) => {
    onCustomEmojiSelect(emoji);
  }, [onCustomEmojiSelect]);

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);

  function renderCover(stickerSet: StickerSetOrRecent, index: number) {
    const firstSticker = stickerSet.stickers?.[0];
    const buttonClassName = buildClassName(
      'symbol-set-button sticker-set-button',
      index === activeSetIndex && 'activated',
    );

    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;
    const isHq = selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSet as ApiStickerSet);

    if (stickerSet.id === RECENT_SYMBOL_SET_ID
      || stickerSet.id === FAVORITE_SYMBOL_SET_ID
      || stickerSet.id === CHAT_STICKER_SET_ID
      || stickerSet.id === PREMIUM_STICKER_SET_ID
      || stickerSet.hasThumbnail
      || !firstSticker
    ) {
      return (
        <Button
          key={stickerSet.id}
          className={buttonClassName}
          ariaLabel={stickerSet.title}
          round
          faded={stickerSet.id === RECENT_SYMBOL_SET_ID || stickerSet.id === FAVORITE_SYMBOL_SET_ID}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => selectStickerSet(index)}
        >
          {stickerSet.id === RECENT_SYMBOL_SET_ID ? (
            <i className="icon-recent" />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noAnimate={!canAnimate || !loadAndPlay}
              observeIntersection={observeIntersectionForCovers}
              sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
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
          noAnimate={!canAnimate || !loadAndPlay}
          observeIntersection={observeIntersectionForCovers}
          noContextMenu
          isCurrentUserPremium
          sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
          onClick={selectStickerSet}
          clickArg={index}
        />
      );
    }
  }

  const fullClassName = buildClassName('StickerPicker', 'CustomEmojiPicker', className);

  if (!areAddedLoaded || !canRenderContents || noPopulatedSets) {
    return (
      <div className={fullClassName}>
        {noPopulatedSets ? (
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
        <div className="shared-canvas-container">
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          {allSets.map(renderCover)}
        </div>
      </div>
      <div
        ref={containerRef}
        className={buildClassName('StickerPicker-main no-selection', IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
      >
        {allSets.map((stickerSet, i) => (
          <StickerSet
            key={stickerSet.id}
            stickerSet={stickerSet}
            loadAndPlay={Boolean(canAnimate && loadAndPlay)}
            index={i}
            observeIntersection={observeIntersection}
            shouldRender={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
            isSavedMessages={isSavedMessages}
            shouldHideRecentHeader={withDefaultTopicIcons}
            withDefaultTopicIcon={withDefaultTopicIcons && stickerSet.id === RECENT_SYMBOL_SET_ID}
            isCustomEmojiPicker
            isCurrentUserPremium={isCurrentUserPremium}
            onStickerSelect={handleEmojiSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const {
      setsById,
    } = global.stickers;

    const isSavedMessages = Boolean(chatId && selectIsChatWithSelf(global, chatId));

    const recentCustomEmoji = Object.values(pickTruthy(global.customEmojis.byId, global.recentCustomEmojis));

    return {
      stickerSetsById: setsById,
      addedCustomEmojiIds: global.customEmojis.added.setIds,
      canAnimate: global.settings.byKey.shouldLoopStickers,
      isSavedMessages,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      recentCustomEmoji,
      featuredCustomEmojiIds: global.customEmojis.featuredIds,
      defaultTopicIconsId: global.defaultTopicIconsId,
    };
  },
)(CustomEmojiPicker));
