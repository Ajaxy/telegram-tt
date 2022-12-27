import React, {
  useState, useEffect, memo, useRef, useMemo, useCallback,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStickerSet, ApiSticker, ApiChat } from '../../../api/types';
import type { StickerSetOrRecent } from '../../../types';
import type { FC } from '../../../lib/teact/teact';

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
import { pickTruthy, uniqueByField } from '../../../util/iteratees';
import { selectChat, selectIsChatWithSelf, selectIsCurrentUserPremium } from '../../../global/selectors';

import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';
import useSendMessageAction from '../../../hooks/useSendMessageAction';

import Avatar from '../../common/Avatar';
import Loading from '../../ui/Loading';
import Button from '../../ui/Button';
import StickerButton from '../../common/StickerButton';
import StickerSet from './StickerSet';
import StickerSetCover from './StickerSetCover';
import PremiumIcon from '../../common/PremiumIcon';

import './StickerPicker.scss';

type OwnProps = {
  chatId: string;
  threadId?: number;
  className: string;
  loadAndPlay: boolean;
  canSendStickers: boolean;
  onStickerSelect: (sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => void;
};

type StateProps = {
  chat?: ApiChat;
  recentStickers: ApiSticker[];
  favoriteStickers: ApiSticker[];
  premiumStickers: ApiSticker[];
  stickerSetsById: Record<string, ApiStickerSet>;
  addedSetIds?: string[];
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
};

const SMOOTH_SCROLL_DISTANCE = 500;
const HEADER_BUTTON_WIDTH = 52; // px (including margin)
const STICKER_INTERSECTION_THROTTLE = 200;

const stickerSetIntersections: boolean[] = [];

const StickerPicker: FC<OwnProps & StateProps> = ({
  chat,
  threadId,
  className,
  loadAndPlay,
  canSendStickers,
  recentStickers,
  favoriteStickers,
  premiumStickers,
  addedSetIds,
  stickerSetsById,
  canAnimate,
  isSavedMessages,
  isCurrentUserPremium,
  onStickerSelect,
}) => {
  const {
    loadRecentStickers,
    addRecentSticker,
    unfaveSticker,
    faveSticker,
    removeRecentSticker,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);

  const [activeSetIndex, setActiveSetIndex] = useState<number>(0);

  const sendMessageAction = useSendMessageAction(chat!.id, threadId);

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

    const defaultSets = [];

    const existingAddedSetIds = Object.values(pickTruthy(stickerSetsById, addedSetIds));

    if (favoriteStickers.length) {
      defaultSets.push({
        id: FAVORITE_SYMBOL_SET_ID,
        title: lang('FavoriteStickers'),
        stickers: favoriteStickers,
        count: favoriteStickers.length,
      });
    }

    if (recentStickers.length) {
      defaultSets.push({
        id: RECENT_SYMBOL_SET_ID,
        title: lang('RecentStickers'),
        stickers: recentStickers,
        count: recentStickers.length,
      });
    }

    if (isCurrentUserPremium) {
      const addedPremiumStickers = existingAddedSetIds
        .map(({ stickers }) => stickers?.filter((sticker) => sticker.hasEffect))
        .flat()
        .filter(Boolean);

      const totalPremiumStickers = uniqueByField([...addedPremiumStickers, ...premiumStickers], 'id');

      if (totalPremiumStickers.length) {
        defaultSets.push({
          id: PREMIUM_STICKER_SET_ID,
          title: lang('PremiumStickers'),
          stickers: totalPremiumStickers,
          count: totalPremiumStickers.length,
        });
      }
    }

    if (chat?.fullInfo?.stickerSet) {
      const fullSet = stickerSetsById[chat.fullInfo.stickerSet.id];
      if (fullSet) {
        defaultSets.push({
          id: CHAT_STICKER_SET_ID,
          title: lang('GroupStickers'),
          stickers: fullSet.stickers,
          count: fullSet.stickers!.length,
        });
      }
    }

    return [
      ...defaultSets,
      ...existingAddedSetIds,
    ];
  }, [
    addedSetIds, stickerSetsById, favoriteStickers, recentStickers, isCurrentUserPremium, chat, lang, premiumStickers,
  ]);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allSets.filter((set) => set.stickers?.length).length === 0
  ), [allSets, areAddedLoaded]);

  useEffect(() => {
    if (!loadAndPlay) return;
    loadRecentStickers();
    if (!canSendStickers) return;
    sendMessageAction({ type: 'chooseSticker' });
  }, [canSendStickers, loadAndPlay, loadRecentStickers, sendMessageAction]);

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

  const handleStickerSelect = useCallback((sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => {
    onStickerSelect(sticker, isSilent, shouldSchedule);
    addRecentSticker({ sticker });
  }, [addRecentSticker, onStickerSelect]);

  const handleStickerUnfave = useCallback((sticker: ApiSticker) => {
    unfaveSticker({ sticker });
  }, [unfaveSticker]);

  const handleStickerFave = useCallback((sticker: ApiSticker) => {
    faveSticker({ sticker });
  }, [faveSticker]);

  const handleMouseMove = useCallback(() => {
    if (!canSendStickers) return;
    sendMessageAction({ type: 'chooseSticker' });
  }, [canSendStickers, sendMessageAction]);

  const handleRemoveRecentSticker = useCallback((sticker: ApiSticker) => {
    removeRecentSticker({ sticker });
  }, [removeRecentSticker]);

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);

  function renderCover(stickerSet: StickerSetOrRecent, index: number) {
    const firstSticker = stickerSet.stickers?.[0];
    const buttonClassName = buildClassName(
      'symbol-set-button sticker-set-button',
      index === activeSetIndex && 'activated',
    );

    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;

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
          {stickerSet.id === PREMIUM_STICKER_SET_ID ? (
            <PremiumIcon withGradient big />
          ) : stickerSet.id === RECENT_SYMBOL_SET_ID ? (
            <i className="icon-recent" />
          ) : stickerSet.id === FAVORITE_SYMBOL_SET_ID ? (
            <i className="icon-favorite" />
          ) : stickerSet.id === CHAT_STICKER_SET_ID ? (
            <Avatar chat={chat} size="small" />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noAnimate={!canAnimate || !loadAndPlay}
              observeIntersection={observeIntersectionForCovers}
              sharedCanvasRef={withSharedCanvas ? sharedCanvasRef : undefined}
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
          sharedCanvasRef={withSharedCanvas ? sharedCanvasRef : undefined}
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
        <div className="shared-canvas-container">
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          {allSets.map(renderCover)}
        </div>
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
            loadAndPlay={Boolean(canAnimate && loadAndPlay)}
            index={i}
            observeIntersection={observeIntersection}
            shouldRender={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
            favoriteStickers={favoriteStickers}
            isSavedMessages={isSavedMessages}
            isCurrentUserPremium={isCurrentUserPremium}
            onStickerSelect={handleStickerSelect}
            onStickerUnfave={handleStickerUnfave}
            onStickerFave={handleStickerFave}
            onStickerRemoveRecent={handleRemoveRecentSticker}
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
      added,
      recent,
      favorite,
      premiumSet,
    } = global.stickers;

    const isSavedMessages = selectIsChatWithSelf(global, chatId);
    const chat = selectChat(global, chatId);

    return {
      chat,
      recentStickers: recent.stickers,
      favoriteStickers: favorite.stickers,
      premiumStickers: premiumSet.stickers,
      stickerSetsById: setsById,
      addedSetIds: added.setIds,
      canAnimate: global.settings.byKey.shouldLoopStickers,
      isSavedMessages,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(StickerPicker));
