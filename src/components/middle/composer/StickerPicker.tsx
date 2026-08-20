import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { setExtraStyles } from '../../../lib/teact/teact-dom';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiEmojiGroup, ApiSticker, ApiStickerSet,
} from '../../../api/types';
import type { StickerSetOrReactionsSetOrRecent, ThreadId } from '../../../types';

import {
  BASE_EMOJI_KEYWORD_LANG,
  CHAT_STICKER_SET_ID,
  EFFECT_EMOJIS_SET_ID,
  EFFECT_STICKERS_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER,
  STICKER_SIZE_PICKER_HEADER,
} from '../../../config';
import { requestForcedReflow } from '../../../lib/fasterdom/fasterdom';
import {
  selectChat,
  selectChatFullInfo,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectShouldLoopStickers,
} from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { waitForTransitionEnd } from '../../../util/cssAnimationEndListeners';
import { isUserId } from '../../../util/entities/ids';
import { pickTruthy, uniqueByField } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import resetScroll from '../../../util/resetScroll';
import { REM } from '../../common/helpers/mediaDimensions';

import { useTransitionActiveKey } from '../../../hooks/animations/useTransitionActiveKey';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useScrolledState from '../../../hooks/useScrolledState';
import useSendMessageAction from '../../../hooks/useSendMessageAction';
import useSyncEffect from '../../../hooks/useSyncEffect';
import { useStickerPickerObservers } from '../../common/hooks/useStickerPickerObservers';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import useEmojiSearch from './hooks/useEmojiSearch';
import useStickerSearch from './hooks/useStickerSearch';

import Avatar from '../../common/Avatar';
import CollapsibleSection from '../../common/CollapsibleSection';
import FoundPacksRow from '../../common/FoundPacksRow';
import Icon from '../../common/icons/Icon';
import InlineStickerSetView, { StickerSetToggleButton } from '../../common/InlineStickerSetView';
import StickerButton from '../../common/StickerButton';
import StickerSet from '../../common/StickerSet';
import TrendingPacksRow from '../../common/TrendingPacksRow';
import Button from '../../ui/Button';
import Loading from '../../ui/Loading';
import Transition from '../../ui/Transition';
import EmojiSearch from './EmojiSearch';
import StickerSetCover from './StickerSetCover';

import styles from './StickerPicker.module.scss';

type OwnProps = {
  chatId: string;
  threadId?: ThreadId;
  className: string;
  isHidden?: boolean;
  isTranslucent?: boolean;
  loadAndPlay: boolean;
  canSendStickers?: boolean;
  noContextMenus?: boolean;
  idPrefix: string;
  onStickerSelect: (
    sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean, canUpdateStickerSetsOrder?: boolean,
  ) => void;
  isForEffects?: boolean;
};

type StateProps = {
  chat?: ApiChat;
  recentStickers: ApiSticker[];
  favoriteStickers: ApiSticker[];
  effectStickers?: ApiSticker[];
  effectEmojis?: ApiSticker[];
  stickerSetsById: Record<string, ApiStickerSet>;
  chatStickerSetId?: string;
  addedSetIds?: string[];
  featuredIds?: string[];
  isTrendingPremium?: boolean;
  hiddenTrendingSetId?: string;
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  baseEmojiKeywords?: Record<string, string[]>;
  emojiKeywords?: Record<string, string[]>;
  stickerGroups?: ApiEmojiGroup[];
};

const HEADER_BUTTON_WIDTH = 2.5 * REM; // px (including margin)
const FOUND_PACK_COVER_SIZE = 3 * REM;
const TRENDING_COVER_SIZE = 1.5 * REM;
const TRENDING_DISMISS_DURATION = 250;
const TRENDING_DISMISS_FALLBACK_MS = TRENDING_DISMISS_DURATION + 100;
const RESULTS_INTERSECTION_THROTTLE = 200;
const LOAD_MORE_THRESHOLD = 500;

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
  effectStickers,
  effectEmojis,
  addedSetIds,
  featuredIds,
  isTrendingPremium,
  hiddenTrendingSetId,
  stickerSetsById,
  chatStickerSetId,
  canAnimate,
  isSavedMessages,
  isCurrentUserPremium,
  baseEmojiKeywords,
  emojiKeywords,
  stickerGroups,
  noContextMenus,
  idPrefix,
  onStickerSelect,
  isForEffects,
}) => {
  const {
    loadRecentStickers,
    addRecentSticker,
    unfaveSticker,
    faveSticker,
    removeRecentSticker,
    loadStickers,
    loadFeaturedStickers,
    hideTrendingStickers,
  } = getActions();

  const containerRef = useRef<HTMLDivElement>();
  const headerRef = useRef<HTMLDivElement>();
  const sharedCanvasRef = useRef<HTMLCanvasElement>();
  const trendingRef = useRef<HTMLDivElement>();

  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const sendMessageAction = useSendMessageAction(chat?.id, threadId);

  const prefix = `${idPrefix}-sticker-set`;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);

  const oldLang = useOldLang();
  const lang = useLang();

  const areAddedLoaded = Boolean(addedSetIds);

  const allSets = useMemo(() => {
    if (isForEffects && effectStickers) {
      const effectSets: StickerSetOrReactionsSetOrRecent[] = [];
      if (effectEmojis?.length) {
        effectSets.push({
          id: EFFECT_EMOJIS_SET_ID,
          accessHash: '0',
          title: '',
          stickers: effectEmojis,
          count: effectEmojis.length,
          isEmoji: true,
        });
      }
      if (effectStickers?.length) {
        effectSets.push({
          id: EFFECT_STICKERS_SET_ID,
          accessHash: '0',
          title: oldLang('StickerEffects'),
          stickers: effectStickers,
          count: effectStickers.length,
        });
      }
      return effectSets;
    }

    if (!addedSetIds) {
      return MEMO_EMPTY_ARRAY;
    }

    const defaultSets = [];

    if (favoriteStickers.length) {
      defaultSets.push({
        id: FAVORITE_SYMBOL_SET_ID,
        accessHash: '0',
        title: oldLang('FavoriteStickers'),
        stickers: favoriteStickers,
        count: favoriteStickers.length,
      });
    }

    if (recentStickers.length) {
      defaultSets.push({
        id: RECENT_SYMBOL_SET_ID,
        accessHash: '0',
        title: oldLang('RecentStickers'),
        stickers: recentStickers,
        count: recentStickers.length,
      });
    }

    const userSetIds = [...(addedSetIds || [])];
    if (chatStickerSetId) {
      userSetIds.unshift(chatStickerSetId);
    }

    const existingAddedSetIds = Object.values(pickTruthy(stickerSetsById, userSetIds));

    return [
      ...defaultSets,
      ...existingAddedSetIds,
    ];
  }, [
    addedSetIds,
    stickerSetsById,
    favoriteStickers,
    recentStickers,
    chatStickerSetId,
    oldLang,
    effectStickers,
    isForEffects,
    effectEmojis,
  ]);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allSets.filter((set) => set.stickers?.length).length === 0
  ), [allSets, areAddedLoaded]);

  const searchableStickers = useMemo(() => {
    if (isForEffects) {
      return undefined;
    }

    return uniqueByField(allSets.flatMap((set) => set.stickers || []), 'id');
  }, [allSets, isForEffects]);

  const {
    query,
    activeGroup,
    isSearchActive,
    customResults,
    setQuery,
    selectGroup,
    markSearchFocused,
    unmarkSearchFocused,
  } = useEmojiSearch({
    baseEmojiKeywords,
    emojiKeywords,
    localStickers: searchableStickers,
    isLocalOnly: true,
    noNativeResults: true,
  });

  const effectiveQuery = activeGroup ? activeGroup.emoticons.join(' ') : query.trim();
  const hasSearch = Boolean(effectiveQuery);

  const { results: searchResults, searchMore } = useStickerSearch({
    query: effectiveQuery || undefined,
    noPacks: activeGroup ? true : undefined,
    isDisabled: isForEffects,
  });

  const [openedPack, setOpenedPack] = useState<ApiStickerSet | undefined>();
  const [isLocalSectionCollapsed, setIsLocalSectionCollapsed] = useState(false);
  const [isGlobalSectionCollapsed, setIsGlobalSectionCollapsed] = useState(false);

  useSyncEffect(() => {
    setIsLocalSectionCollapsed(false);
    setIsGlobalSectionCollapsed(false);
  }, [effectiveQuery]);
  const openedSet = openedPack && (stickerSetsById[openedPack.id] || openedPack);
  const isOpenedSetLoading = Boolean(openedSet && (openedSet.stickers?.length || 0) < openedSet.count);

  const searchDisplayRef = useRef<{
    key: string;
    isCategory?: boolean;
    packSets?: ApiStickerSet[];
    localStickers?: ApiSticker[];
    globalStickers?: ApiSticker[];
  }>();
  if (hasSearch && searchResults?.key === effectiveQuery) {
    searchDisplayRef.current = {
      key: effectiveQuery,
      isCategory: Boolean(activeGroup),
      // Full sets loaded on demand (e.g. for covers) land in `stickerSetsById`, so prefer them over search snapshots
      packSets: searchResults.packSets?.map((set) => stickerSetsById[set.id] || set),
      localStickers: customResults,
      globalStickers: searchResults.globalStickers,
    };
  } else if (searchDisplayRef.current?.key === effectiveQuery && !searchDisplayRef.current.isCategory) {
    searchDisplayRef.current.localStickers = customResults;
  }
  const searchDisplay = hasSearch ? searchDisplayRef.current : undefined;
  const isShowingSearchResults = Boolean(searchDisplay);
  const isSearchLoading = hasSearch && searchDisplay?.key !== effectiveQuery;

  const contentActiveKey = useTransitionActiveKey([isShowingSearchResults, searchDisplay?.key, openedSet?.id]);

  const { observe: observeIntersectionForResults } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: RESULTS_INTERSECTION_THROTTLE,
  });

  useLayoutEffect(() => {
    if (containerRef.current) {
      resetScroll(containerRef.current, 0);
    }
  }, [isShowingSearchResults, searchDisplay?.key, openedSet?.id]);

  useEffect(() => {
    if (!loadAndPlay) return;
    loadRecentStickers();
    loadFeaturedStickers();
    if (!canSendStickers) return;
    sendMessageAction({ type: 'chooseSticker' });
  }, [canSendStickers, loadAndPlay, loadRecentStickers, loadFeaturedStickers, sendMessageAction]);

  const trendingSets = useMemo(() => {
    if (isForEffects || !featuredIds?.length || hiddenTrendingSetId === featuredIds[0]) {
      return undefined;
    }

    const sets = featuredIds
      .map((id) => stickerSetsById[id])
      .filter((set) => set && !(set.installedDate && !set.isArchived));

    return sets.length ? sets : undefined;
  }, [isForEffects, featuredIds, hiddenTrendingSetId, stickerSetsById]);

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const shouldRenderContents = areAddedLoaded && canRenderContents
    && !(isForEffects && noPopulatedSets) && (canSendStickers || isForEffects);

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

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    handleContentScroll(e);

    if (!isShowingSearchResults || openedSet || isGlobalSectionCollapsed) {
      return;
    }

    const container = e.currentTarget;
    if (container.scrollHeight - container.scrollTop - container.clientHeight < LOAD_MORE_THRESHOLD) {
      searchMore();
    }
  });

  const handleFoundPackClick = useLastCallback((set: ApiStickerSet) => {
    setOpenedPack(set);

    if (!stickerSetsById[set.id] || !set.stickers || set.stickers.length < set.count) {
      loadStickers({ stickerSetInfo: { id: set.id, accessHash: set.accessHash } });
    }
  });

  const handlePackBackClick = useLastCallback(() => {
    setOpenedPack(undefined);
  });

  const handleTrendingDismiss = useLastCallback(() => {
    const el = trendingRef.current;
    if (!el) {
      hideTrendingStickers();
      return;
    }

    requestForcedReflow(() => {
      const height = el.scrollHeight;

      return () => {
        setExtraStyles(el, { height: `${height}px`, overflow: 'hidden' });

        requestForcedReflow(() => {
          void el.offsetHeight;

          return () => {
            setExtraStyles(el, {
              height: '0px',
              marginBottom: '0',
              opacity: '0',
              transition: `height ${TRENDING_DISMISS_DURATION}ms ease-in-out, `
                + `opacity ${TRENDING_DISMISS_DURATION}ms ease-in-out, `
                + `margin-bottom ${TRENDING_DISMISS_DURATION}ms ease-in-out`,
            });

            waitForTransitionEnd(el, () => {
              hideTrendingStickers();
            }, 'height', TRENDING_DISMISS_FALLBACK_MS);
          };
        });
      };
    });
  });

  const handleLocalSectionToggle = useLastCallback(() => {
    setIsLocalSectionCollapsed(!isLocalSectionCollapsed);
  });

  const handleGlobalSectionToggle = useLastCallback(() => {
    setIsGlobalSectionCollapsed(!isGlobalSectionCollapsed);
  });

  const handleQueryChange = useLastCallback((value: string) => {
    setOpenedPack(undefined);
    setQuery(value);
  });

  const handleGroupSelect = useLastCallback((group?: ApiEmojiGroup) => {
    setOpenedPack(undefined);
    selectGroup(group);
  });

  if (!chat) return undefined;

  function renderCover(stickerSet: StickerSetOrReactionsSetOrRecent, index: number) {
    const firstSticker = stickerSet.stickers?.[0];
    const buttonClassName = buildClassName(styles.stickerCover, index === activeSetIndex && styles.activated);
    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;

    if (stickerSet.id === RECENT_SYMBOL_SET_ID
      || stickerSet.id === FAVORITE_SYMBOL_SET_ID
      || stickerSet.id === CHAT_STICKER_SET_ID
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

          onClick={() => selectStickerSet(index)}
        >
          {stickerSet.id === RECENT_SYMBOL_SET_ID ? (
            <Icon name="recent" />
          ) : stickerSet.id === FAVORITE_SYMBOL_SET_ID ? (
            <Icon name="favorite" />
          ) : stickerSet.id === CHAT_STICKER_SET_ID ? (
            <Avatar peer={chat} size="small" />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noPlay={!canAnimate || !loadAndPlay}
              observeIntersection={observeIntersectionForCovers}
              sharedCanvasRef={withSharedCanvas ? sharedCanvasRef : undefined}
              forcePlayback
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
          className={buildClassName(buttonClassName, styles.stickerCoverSticker)}
          noPlay={!canAnimate || !loadAndPlay}
          observeIntersection={observeIntersectionForCovers}
          noContextMenu
          isCurrentUserPremium
          sharedCanvasRef={withSharedCanvas ? sharedCanvasRef : undefined}
          withTranslucentThumb={isTranslucent}
          onClick={selectStickerSet}
          clickArg={index}
          forcePlayback
        />
      );
    }
  }

  function renderFoundPack(set: ApiStickerSet, index: number) {
    const firstSticker = set.covers?.[0] || set.stickers?.[0];

    return (
      <Button
        key={set.id}
        className={styles.foundPack}
        color="translucent"
        ariaLabel={set.title}

        onClick={() => handleFoundPackClick(set)}
      >
        {set.hasThumbnail || !firstSticker ? (
          <StickerSetCover
            stickerSet={set}
            size={FOUND_PACK_COVER_SIZE}
            noPlay={!canAnimate || !loadAndPlay}
            observeIntersection={observeIntersectionForResults}
            forcePlayback
          />
        ) : (
          <StickerButton
            sticker={firstSticker}
            size={FOUND_PACK_COVER_SIZE}
            className={styles.foundPackCover}
            noPlay={!canAnimate || !loadAndPlay}
            observeIntersection={observeIntersectionForResults}
            noContextMenu
            isCurrentUserPremium
            withTranslucentThumb={isTranslucent}
            clickArg={index}
            forcePlayback
          />
        )}
        <span className={styles.foundPackTitle}>{set.title}</span>
      </Button>
    );
  }

  function renderTrendingPack(set: ApiStickerSet) {
    const firstSticker = set.covers?.[0] || set.stickers?.[0];

    return (
      <Button
        key={set.id}
        className={styles.trendingPack}
        color="translucent"
        ariaLabel={set.title}

        onClick={() => handleFoundPackClick(set)}
      >
        {set.hasThumbnail || !firstSticker ? (
          <StickerSetCover
            stickerSet={set}
            size={TRENDING_COVER_SIZE}
            noPlay={!canAnimate || !loadAndPlay}
            observeIntersection={observeIntersectionForResults}
            forcePlayback
          />
        ) : (
          <StickerButton
            sticker={firstSticker}
            size={TRENDING_COVER_SIZE}
            className={styles.trendingPackCover}
            noPlay={!canAnimate || !loadAndPlay}
            observeIntersection={observeIntersectionForResults}
            noContextMenu
            isCurrentUserPremium
            withTranslucentThumb={isTranslucent}
            clickArg={undefined}
            forcePlayback
          />
        )}
      </Button>
    );
  }

  function renderTrending() {
    return (
      <div ref={trendingRef} className="symbol-set">
        <div className="symbol-set-header">
          <p className="symbol-set-title">
            <span className="symbol-set-name">
              {lang(isTrendingPremium ? 'TrendingPremiumStickers' : 'TrendingStickers')}
            </span>
          </p>
          <Button
            className={styles.trendingClose}
            round
            size="tiny"
            color="translucent"
            ariaLabel={lang('AccDescrCloseTrendingStickers')}

            onClick={handleTrendingDismiss}
          >
            <Icon name="close" />
          </Button>
        </div>
        <TrendingPacksRow>
          {trendingSets!.map(renderTrendingPack)}
        </TrendingPacksRow>
      </div>
    );
  }

  function renderResultStickers(stickers: ApiSticker[]) {
    return stickers.map((sticker) => (
      <StickerButton
        key={sticker.id}
        sticker={sticker}
        size={STICKER_SIZE_PICKER}
        observeIntersection={observeIntersectionForResults}
        noPlay={!canAnimate || !loadAndPlay}
        noContextMenu={noContextMenus}
        isCurrentUserPremium={isCurrentUserPremium}
        withTranslucentThumb={isTranslucent}
        onClick={canSendStickers ? handleStickerSelect : undefined}
        clickArg={sticker}
        forcePlayback
      />
    ));
  }

  function renderResultSection(
    title: string, stickers: ApiSticker[], isCollapsed: boolean, onToggle: NoneToVoidFunction,
  ) {
    return (
      <CollapsibleSection
        className={styles.resultSection}
        title={title}
        isCollapsed={isCollapsed}
        onToggle={onToggle}
      >
        <div className={styles.resultGrid}>
          {renderResultStickers(stickers)}
        </div>
      </CollapsibleSection>
    );
  }

  function renderOpenedPack() {
    return (
      <InlineStickerSetView
        stickerSet={openedSet!}
        stickerSize={STICKER_SIZE_PICKER}
        observeIntersection={observeIntersectionForResults}
        noPlay={!canAnimate || !loadAndPlay}
        noContextMenus={noContextMenus}
        isSavedMessages={isSavedMessages}
        isCurrentUserPremium={isCurrentUserPremium}
        isTranslucent={isTranslucent}
        onStickerSelect={canSendStickers ? handleStickerSelect : undefined}
      />
    );
  }

  function renderSearchResults() {
    const {
      isCategory, packSets, localStickers, globalStickers,
    } = searchDisplay!;
    const localStickerIds = new Set((localStickers || []).map(({ id }) => id));
    const dedupedGlobalStickers = globalStickers?.filter(({ id }) => !localStickerIds.has(id));

    if (isCategory) {
      if (!globalStickers?.length) {
        return <div className={styles.pickerDisabled}>{lang('NoStickersFound')}</div>;
      }
      return (
        <div className={styles.resultGrid}>
          {renderResultStickers(globalStickers)}
        </div>
      );
    }

    const hasAny = Boolean(packSets?.length || localStickers?.length || dedupedGlobalStickers?.length);

    if (!hasAny) {
      return <div className={styles.pickerDisabled}>{lang('NoStickersFound')}</div>;
    }

    return (
      <div>
        {Boolean(packSets?.length) && (
          <FoundPacksRow>
            {packSets.map(renderFoundPack)}
          </FoundPacksRow>
        )}
        {Boolean(localStickers?.length) && renderResultSection(
          lang('StickerSearchResult'), localStickers, isLocalSectionCollapsed, handleLocalSectionToggle,
        )}
        {Boolean(dedupedGlobalStickers?.length) && renderResultSection(
          lang('StickerSearchGlobalResult'), dedupedGlobalStickers, isGlobalSectionCollapsed, handleGlobalSectionToggle,
        )}
      </div>
    );
  }

  const fullClassName = buildClassName(styles.root, className);
  const headerClassName = buildClassName(
    styles.header,
    'no-scrollbar',
    !shouldHideTopBorder && styles.headerWithBorder,
  );

  const isLoading = !shouldRenderContents && (canSendStickers || isForEffects)
    && !(isForEffects && noPopulatedSets);

  return (
    <Transition className={fullClassName} activeKey={isLoading ? 0 : 1} name="fade" shouldCleanup>
      {!shouldRenderContents ? (
        !canSendStickers && !isForEffects ? (
          <div className={styles.pickerDisabled}>{oldLang('ErrorSendRestrictedStickersAll')}</div>
        ) : noPopulatedSets ? (
          <div className={styles.pickerDisabled}>{oldLang('NoStickers')}</div>
        ) : (
          <Loading />
        )
      ) : (
        <div
          className={buildClassName(
            styles.inner,
            !isForEffects && styles.withSearch,
            !isForEffects && isSearchActive && styles.searchActive,
          )}
        >
          {!isForEffects && (
            <div ref={headerRef} className={headerClassName}>
              <div className="shared-canvas-container">
                <canvas ref={sharedCanvasRef} className="shared-canvas" />
                {allSets.map(renderCover)}
              </div>
            </div>
          )}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onScroll={handleScroll}
            className={
              buildClassName(
                styles.main,
                IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
                !isForEffects && styles.mainWithSearch,
              )
            }
          >
            {!isForEffects && (
              <EmojiSearch
                value={query}
                groups={stickerGroups}
                activeGroup={activeGroup}
                placeholder={lang('SearchStickers')}
                isLoading={isSearchLoading || isOpenedSetLoading}
                hasBackButton={Boolean(openedSet)}
                className={styles.search}
                onChange={handleQueryChange}
                onGroupSelect={handleGroupSelect}
                onBackClick={handlePackBackClick}
                onFocus={markSearchFocused}
                onBlur={unmarkSearchFocused}
              />
            )}
            <Transition
              name="fade"
              activeKey={contentActiveKey}
              className={styles.contentTransition}
              shouldCleanup
            >
              {openedSet ? renderOpenedPack() : isShowingSearchResults ? renderSearchResults() : (
                <div>
                  {trendingSets && renderTrending()}
                  {noPopulatedSets && (
                    <div className={styles.pickerDisabled}>{oldLang('NoStickers')}</div>
                  )}
                  {allSets.map((stickerSet, i) => (
                    <StickerSet
                      key={stickerSet.id}
                      stickerSet={stickerSet}
                      loadAndPlay={Boolean(canAnimate && loadAndPlay)}
                      noContextMenus={noContextMenus}
                      index={i}
                      idPrefix={prefix}
                      observeIntersection={observeIntersectionForSet}
                      observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
                      observeIntersectionForShowingItems={observeIntersectionForShowingItems}
                      isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
                      favoriteStickers={favoriteStickers}
                      isSavedMessages={isSavedMessages}
                      isCurrentUserPremium={isCurrentUserPremium}
                      isTranslucent={isTranslucent}
                      isChatStickerSet={stickerSet.id === chatStickerSetId}
                      onStickerSelect={handleStickerSelect}
                      onStickerUnfave={handleStickerUnfave}
                      onStickerFave={handleStickerFave}
                      onStickerRemoveRecent={handleRemoveRecentSticker}
                      forcePlayback
                      shouldHideHeader={stickerSet.id === EFFECT_EMOJIS_SET_ID}
                    />
                  ))}
                </div>
              )}
            </Transition>
          </div>
          {openedSet && <StickerSetToggleButton stickerSet={openedSet} />}
        </div>
      )}
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const {
      setsById,
      added,
      recent,
      favorite,
      effect,
      featured,
    } = global.stickers;

    const isSavedMessages = selectIsChatWithSelf(global, chatId);
    const chat = selectChat(global, chatId);
    const chatStickerSetId = !isUserId(chatId) ? selectChatFullInfo(global, chatId)?.stickerSet?.id : undefined;

    const { language } = selectSharedSettings(global);
    const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
    const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;

    return {
      chat,
      effectStickers: effect?.stickers,
      effectEmojis: effect?.emojis,
      recentStickers: recent.stickers,
      favoriteStickers: favorite.stickers,
      stickerSetsById: setsById,
      addedSetIds: added.setIds,
      featuredIds: featured.setIds,
      isTrendingPremium: featured.isPremium,
      hiddenTrendingSetId: featured.hiddenSetId,
      canAnimate: selectShouldLoopStickers(global),
      isSavedMessages,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      chatStickerSetId,
      baseEmojiKeywords: baseEmojiKeywords?.keywords,
      emojiKeywords: emojiKeywords?.keywords,
      stickerGroups: global.emojiGroups.stickerGroups,
    };
  },
)(StickerPicker));
