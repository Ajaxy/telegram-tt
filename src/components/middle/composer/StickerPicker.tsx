import type { FC } from '../../../lib/teact/teact';
import React, {
  useState, useEffect, memo, useRef, useMemo, useCallback,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStickerSet, ApiSticker, ApiChat } from '../../../api/types';
import type { StickerSetOrRecent } from '../../../types';

import {
  CHAT_STICKER_SET_ID,
  FAVORITE_SYMBOL_SET_ID, RECENT_SYMBOL_SET_ID, SLIDE_TRANSITION_DURATION, STICKER_SIZE_PICKER_HEADER,
} from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import fastSmoothScroll from '../../../util/fastSmoothScroll';
import buildClassName from '../../../util/buildClassName';
import fastSmoothScrollHorizontal from '../../../util/fastSmoothScrollHorizontal';
import { pickTruthy } from '../../../util/iteratees';
import { selectChat, selectIsChatWithSelf } from '../../../global/selectors';

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
import StickerSetCoverAnimated from './StickerSetCoverAnimated';

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
  stickerSetsById: Record<string, ApiStickerSet>;
  addedSetIds?: string[];
  shouldPlay?: boolean;
  isSavedMessages?: boolean;
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
  addedSetIds,
  stickerSetsById,
  shouldPlay,
  isSavedMessages,
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
      ...Object.values(pickTruthy(stickerSetsById, addedSetIds)),
    ];
  }, [addedSetIds, favoriteStickers, recentStickers, chat, lang, stickerSetsById]);

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
    sendMessageAction({ type: 'chooseSticker' });
  }, [sendMessageAction]);

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

    if (stickerSet.id === RECENT_SYMBOL_SET_ID
      || stickerSet.id === FAVORITE_SYMBOL_SET_ID
      || stickerSet.id === CHAT_STICKER_SET_ID
      || stickerSet.hasThumbnail
      || !firstSticker) {
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
          ) : stickerSet.id === FAVORITE_SYMBOL_SET_ID ? (
            <i className="icon-favorite" />
          ) : stickerSet.id === CHAT_STICKER_SET_ID ? (
            <Avatar chat={chat} size="small" />
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
          noContextMenu
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
            onStickerFave={handleStickerFave}
            onStickerRemoveRecent={handleRemoveRecentSticker}
            favoriteStickers={favoriteStickers}
            isSavedMessages={isSavedMessages}
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
    } = global.stickers;

    const isSavedMessages = selectIsChatWithSelf(global, chatId);
    const chat = selectChat(global, chatId);

    return {
      chat,
      recentStickers: recent.stickers,
      favoriteStickers: favorite.stickers,
      stickerSetsById: setsById,
      addedSetIds: added.setIds,
      shouldPlay: global.settings.byKey.shouldLoopStickers,
      isSavedMessages,
    };
  },
)(StickerPicker));
