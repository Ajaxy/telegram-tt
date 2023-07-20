import React, {
  useEffect, memo, useRef, useMemo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStickerSet, ApiSticker, ApiChat } from '../../../api/types';
import type { StickerSetOrReactionsSetOrRecent } from '../../../types';
import type { FC } from '../../../lib/teact/teact';

import {
  CHAT_STICKER_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  PREMIUM_STICKER_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER_HEADER,
} from '../../../config';
import { REM } from '../../common/helpers/mediaDimensions';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { isUserId } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import { pickTruthy, uniqueByField } from '../../../util/iteratees';
import {
  selectChat, selectChatFullInfo, selectIsChatWithSelf, selectIsCurrentUserPremium, selectShouldLoopStickers,
} from '../../../global/selectors';

import useLastCallback from '../../../hooks/useLastCallback';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';
import useSendMessageAction from '../../../hooks/useSendMessageAction';
import { useStickerPickerObservers } from '../../common/hooks/useStickerPickerObservers';
import useScrolledState from '../../../hooks/useScrolledState';

import Avatar from '../../common/Avatar';
import Loading from '../../ui/Loading';
import Button from '../../ui/Button';
import StickerButton from '../../common/StickerButton';
import StickerSet from '../../common/StickerSet';
import StickerSetCover from './StickerSetCover';
import PremiumIcon from '../../common/PremiumIcon';

import styles from './StickerPicker.module.scss';

type OwnProps = {
  chatId: string;
  threadId?: number;
  className: string;
  isHidden?: boolean;
  isTranslucent?: boolean;
  loadAndPlay: boolean;
  canSendStickers?: boolean;
  onStickerSelect: (
    sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean, canUpdateStickerSetsOrder?: boolean,
  ) => void;
};

type StateProps = {
  chat?: ApiChat;
  recentStickers: ApiSticker[];
  favoriteStickers: ApiSticker[];
  premiumStickers: ApiSticker[];
  stickerSetsById: Record<string, ApiStickerSet>;
  chatStickerSetId?: string;
  addedSetIds?: string[];
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
};

const HEADER_BUTTON_WIDTH = 2.5 * REM; // px (including margin)

const StickerPicker: FC<OwnProps & StateProps> = ({
  chat,
  threadId,
  className,
  isHidden,
  isTranslucent,
  loadAndPlay,
  canSendStickers,
  recentStickers,
  favoriteStickers,
  premiumStickers,
  addedSetIds,
  stickerSetsById,
  chatStickerSetId,
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

  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const sendMessageAction = useSendMessageAction(chat!.id, threadId);

  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, 'sticker-set', isHidden);

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
        accessHash: '0',
        title: lang('FavoriteStickers'),
        stickers: favoriteStickers,
        count: favoriteStickers.length,
      });
    }

    if (recentStickers.length) {
      defaultSets.push({
        id: RECENT_SYMBOL_SET_ID,
        accessHash: '0',
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
          accessHash: '0',
          title: lang('PremiumStickers'),
          stickers: totalPremiumStickers,
          count: totalPremiumStickers.length,
        });
      }
    }

    if (chatStickerSetId) {
      const fullSet = stickerSetsById[chatStickerSetId];
      if (fullSet) {
        defaultSets.push({
          id: CHAT_STICKER_SET_ID,
          accessHash: fullSet.accessHash,
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
    addedSetIds, stickerSetsById, favoriteStickers, recentStickers, isCurrentUserPremium, chatStickerSetId, lang,
    premiumStickers,
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

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const shouldRenderContents = areAddedLoaded && canRenderContents && !noPopulatedSets && canSendStickers;

  useHorizontalScroll(headerRef, !shouldRenderContents || !headerRef.current);

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

    animateHorizontalScroll(header, newLeft);
  }, [areAddedLoaded, activeSetIndex]);

  const handleStickerSelect = useLastCallback((sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => {
    onStickerSelect(sticker, isSilent, shouldSchedule, true);
    addRecentSticker({ sticker });
  });

  const handleStickerUnfave = useLastCallback((sticker: ApiSticker) => {
    unfaveSticker({ sticker });
  });

  const handleStickerFave = useLastCallback((sticker: ApiSticker) => {
    faveSticker({ sticker });
  });

  const handleMouseMove = useLastCallback(() => {
    if (!canSendStickers) return;
    sendMessageAction({ type: 'chooseSticker' });
  });

  const handleRemoveRecentSticker = useLastCallback((sticker: ApiSticker) => {
    removeRecentSticker({ sticker });
  });

  function renderCover(stickerSet: StickerSetOrReactionsSetOrRecent, index: number) {
    const firstSticker = stickerSet.stickers?.[0];
    const buttonClassName = buildClassName(styles.stickerCover, index === activeSetIndex && styles.activated);
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
            <i className="icon icon-recent" />
          ) : stickerSet.id === FAVORITE_SYMBOL_SET_ID ? (
            <i className="icon icon-favorite" />
          ) : stickerSet.id === CHAT_STICKER_SET_ID ? (
            <Avatar peer={chat} size="small" />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noPlay={!canAnimate || !loadAndPlay}
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
          noPlay={!canAnimate || !loadAndPlay}
          observeIntersection={observeIntersectionForCovers}
          noContextMenu
          isCurrentUserPremium
          sharedCanvasRef={withSharedCanvas ? sharedCanvasRef : undefined}
          withTranslucentThumb={isTranslucent}
          onClick={selectStickerSet}
          clickArg={index}
        />
      );
    }
  }

  const fullClassName = buildClassName(styles.root, className);

  if (!shouldRenderContents) {
    return (
      <div className={fullClassName}>
        {!canSendStickers ? (
          <div className={styles.pickerDisabled}>{lang('ErrorSendRestrictedStickersAll')}</div>
        ) : noPopulatedSets ? (
          <div className={styles.pickerDisabled}>{lang('NoStickers')}</div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }

  const headerClassName = buildClassName(
    styles.header,
    'no-scrollbar',
    !shouldHideTopBorder && styles.headerWithBorder,
  );

  return (
    <div className={fullClassName}>
      <div ref={headerRef} className={headerClassName}>
        <div className="shared-canvas-container">
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          {allSets.map(renderCover)}
        </div>
      </div>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onScroll={handleContentScroll}
        className={buildClassName(styles.main, IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
      >
        {allSets.map((stickerSet, i) => (
          <StickerSet
            key={stickerSet.id}
            stickerSet={stickerSet}
            loadAndPlay={Boolean(canAnimate && loadAndPlay)}
            index={i}
            observeIntersection={observeIntersectionForSet}
            observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
            observeIntersectionForShowingItems={observeIntersectionForShowingItems}
            isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
            favoriteStickers={favoriteStickers}
            isSavedMessages={isSavedMessages}
            isCurrentUserPremium={isCurrentUserPremium}
            isTranslucent={isTranslucent}
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
    const chatStickerSetId = !isUserId(chatId) ? selectChatFullInfo(global, chatId)?.stickerSet?.id : undefined;

    return {
      chat,
      recentStickers: recent.stickers,
      favoriteStickers: favorite.stickers,
      premiumStickers: premiumSet.stickers,
      stickerSetsById: setsById,
      addedSetIds: added.setIds,
      canAnimate: selectShouldLoopStickers(global),
      isSavedMessages,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      chatStickerSetId,
    };
  },
)(StickerPicker));
