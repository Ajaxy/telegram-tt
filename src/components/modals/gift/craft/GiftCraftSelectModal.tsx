import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiSavedStarGift, ApiStarGift, ApiStarGiftUnique } from '../../../../api/types';
import type { TabState } from '../../../../global/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import { getSavedGiftKey } from '../../../../global/helpers/stars';
import { selectTabState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { throttle } from '../../../../util/schedulers';
import { formatPercent } from '../../../../util/textFormat';
import { getGiftAttributes } from '../../../common/helpers/gifts';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useFlag from '../../../../hooks/useFlag';
import useInfiniteScroll from '../../../../hooks/useInfiniteScroll';
import { useIntersectionObserver } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePrevious from '../../../../hooks/usePrevious';

import Checkbox from '../../../ui/Checkbox';
import InfiniteScroll from '../../../ui/InfiniteScroll';
import Loading from '../../../ui/Loading';
import Modal from '../../../ui/Modal';
import Transition from '../../../ui/Transition';
import GiftItemStar from '../GiftItemStar';
import GiftResaleFilters from '../GiftResaleFilters';
import ResaleGiftsNotFound from '../ResaleGiftsNotFound';

import styles from './GiftCraftSelectModal.module.scss';

export type OwnProps = {
  modal: TabState['giftCraftSelectModal'];
};

type StateProps = {
  craftModal?: TabState['giftCraftModal'];
};

const CRAFT_GIFTS_LIMIT = 50;
const INTERSECTION_THROTTLE = 200;
const SCROLL_THROTTLE = 200;

const runThrottledForScroll = throttle((cb: NoneToVoidFunction) => cb(), SCROLL_THROTTLE, true);

type CraftGiftItemProps = {
  gift: ApiStarGift;
  chancePercent?: number;
  chanceColor?: string;
  showPrice?: boolean;
  observe?: ObserveFn;
  onClick: (gift: ApiStarGift) => void;
};

const CraftGiftItem = memo(({ gift, chancePercent, chanceColor, showPrice, observe, onClick }: CraftGiftItemProps) => {
  return (
    <div className={styles.giftWrapper}>
      <GiftItemStar
        gift={gift}
        observeIntersection={observe}
        hideBadge={!showPrice}
        onClick={onClick}
      />
      {Boolean(chancePercent && chancePercent > 0) && (
        <span
          className={styles.giftChance}
          style={chanceColor ? `background-color: ${chanceColor}` : undefined}
        >
          +
          {formatPercent(chancePercent!, 0)}
        </span>
      )}
    </div>
  );
});

const GiftCraftSelectModal = ({ modal, craftModal }: OwnProps & StateProps) => {
  const {
    closeGiftCraftSelectModal, selectGiftForCraft,
    loadMoreCraftableGifts, loadMoreMarketCraftableGifts,
    updateCraftGiftsFilter, openGiftInfoModal,
  } = getActions();

  const scrollerRef = useRef<HTMLDivElement>();
  const dialogRef = useRef<HTMLDivElement>();
  const filtersSeparatorRef = useRef<HTMLDivElement>();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isFiltersSeparatorAbove, setIsFiltersSeparatorAbove] = useState(false);
  const [wasStarsOnlyToggleShown, markStarsOnlyToggleShown, resetStarsOnlyToggleShown] = useFlag(false);

  const lang = useLang();
  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const renderingCraftModal = useCurrentOrPrev(craftModal);

  const {
    gift1,
    gift2,
    gift3,
    gift4,
    myCraftableGifts,
    marketCraftableGifts,
    marketFilter,
    marketUpdateIteration = 0,
    marketCraftableGiftsCount,
    myCraftableGiftsNextOffset,
    marketCraftableGiftsNextOffset,
    isMarketLoading,
  } = renderingCraftModal || {};

  const { isLoading } = renderingModal || {};

  const hasMoreMyGifts = Boolean(myCraftableGiftsNextOffset);
  const hasMoreMarketGifts = Boolean(marketCraftableGiftsNextOffset);

  const { observe } = useIntersectionObserver({
    rootRef: scrollerRef,
    throttleMs: INTERSECTION_THROTTLE,
    isDisabled: !isOpen,
  });

  const hasMarketGiftsData = Boolean(marketCraftableGifts?.length);
  const isMyDataLoaded = myCraftableGifts !== undefined;
  const isMarketDataLoaded = marketCraftableGifts !== undefined;
  const isDataLoaded = isMyDataLoaded && isMarketDataLoaded && !isLoading;
  const prevMarketIteration = usePrevious(marketUpdateIteration);
  const isMarketJustUpdated = prevMarketIteration !== undefined && prevMarketIteration !== marketUpdateIteration;
  const isFiltersStuck = isScrolled && isFiltersSeparatorAbove;
  const shouldShowTitleBorder = isScrolled && !isFiltersStuck;

  const handleScroll = useLastCallback((e: { currentTarget: HTMLDivElement }) => {
    const scroller = e.currentTarget;

    runThrottledForScroll(() => {
      setIsScrolled(scroller.scrollTop > 0);

      const separator = filtersSeparatorRef.current;
      if (separator && hasMarketGiftsData) {
        const scrollerRect = scroller.getBoundingClientRect();
        const separatorRect = separator.getBoundingClientRect();
        setIsFiltersSeparatorAbove(separatorRect.top <= scrollerRect.top);
      }
    });
  });

  const selectedIds = useMemo(() => {
    return new Set(
      [gift1, gift2, gift3, gift4]
        .filter((g): g is ApiSavedStarGift => Boolean(g))
        .map((g) => getSavedGiftKey(g)),
    );
  }, [gift1, gift2, gift3, gift4]);

  const selectedUniqueIds = useMemo(() => {
    return new Set(
      [gift1, gift2, gift3, gift4]
        .filter((g): g is ApiSavedStarGift => Boolean(g) && g.gift.type === 'starGiftUnique')
        .map((g) => (g.gift as ApiStarGiftUnique).id),
    );
  }, [gift1, gift2, gift3, gift4]);

  const availableMyGifts = useMemo(() => {
    if (!myCraftableGifts) return [];
    return myCraftableGifts.filter((g) => {
      if (g.gift.type === 'starGiftUnique' && selectedUniqueIds.has(g.gift.id)) {
        return false;
      }
      return !selectedIds.has(getSavedGiftKey(g));
    });
  }, [myCraftableGifts, selectedIds, selectedUniqueIds]);

  const availableMarketGifts = useMemo(() => {
    if (!marketCraftableGifts) return [];
    return marketCraftableGifts.filter((g) => !selectedUniqueIds.has(g.id));
  }, [marketCraftableGifts, selectedUniqueIds]);

  const myGiftByIdMap = useMemo(() => {
    const map = new Map<string, ApiSavedStarGift>();
    availableMyGifts.forEach((g) => {
      if (g.gift.type === 'starGiftUnique') {
        map.set(g.gift.id, g);
      }
    });
    return map;
  }, [availableMyGifts]);

  const handleLoadMore = useLastCallback(() => {
    if (hasMoreMyGifts) {
      loadMoreCraftableGifts();
    } else if (hasMoreMarketGifts) {
      loadMoreMarketCraftableGifts();
    }
  });

  const allItemIds = useMemo(() => {
    const myIds = availableMyGifts.map((g) => `my-${getSavedGiftKey(g)}`);
    const marketIds = availableMarketGifts.map((g) => `market-${g.id}`);
    return [...myIds, ...marketIds];
  }, [availableMyGifts, availableMarketGifts]);

  const [viewportIds, getMore] = useInfiniteScroll(
    handleLoadMore,
    allItemIds,
    !isOpen,
    CRAFT_GIFTS_LIMIT,
  );

  const handleClose = useLastCallback(() => {
    closeGiftCraftSelectModal();
  });

  const handleMyGiftClick = useLastCallback((gift: ApiStarGift) => {
    if (gift.type !== 'starGiftUnique') return;
    const savedGift = myGiftByIdMap.get(gift.id);
    const slotIndex = renderingModal?.slotIndex;
    if (savedGift && slotIndex !== undefined) {
      selectGiftForCraft({ gift: savedGift, slotIndex });
    }
  });

  const handleMarketGiftClick = useLastCallback((gift: ApiStarGift) => {
    const slotIndex = renderingModal?.slotIndex;
    if (slotIndex === undefined) return;

    openGiftInfoModal({ gift, craftSlotIndex: slotIndex });
  });

  const handleResetMarketFilter = useLastCallback(() => {
    updateCraftGiftsFilter({
      filter: {
        sortType: marketFilter?.sortType || 'byPrice',
        modelAttributes: [],
        backdropAttributes: [],
        patternAttributes: [],
        starsOnly: undefined,
      },
    });
  });

  const handleStarsOnlyChange = useLastCallback((isChecked: boolean) => {
    updateCraftGiftsFilter({
      filter: {
        ...marketFilter,
        sortType: marketFilter?.sortType || 'byPrice',
        starsOnly: isChecked,
      },
    });
  });

  const isStarsOnly = Boolean(marketFilter?.starsOnly);

  useEffect(() => {
    if (!isOpen) {
      resetStarsOnlyToggleShown();
    }
  }, [isOpen, resetStarsOnlyToggleShown]);

  useEffect(() => {
    if (marketCraftableGiftsCount && !isMarketLoading) {
      markStarsOnlyToggleShown();
    }
  }, [marketCraftableGiftsCount, isMarketLoading, markStarsOnlyToggleShown]);

  const hasMyGifts = availableMyGifts.length > 0;
  const hasMarketGifts = availableMarketGifts.length > 0;
  const isMarketGiftsEmpty = !hasMarketGifts && Boolean(marketCraftableGifts);
  const hasMarketFilter = Boolean(
    marketFilter?.modelAttributes?.length
    || marketFilter?.patternAttributes?.length
    || marketFilter?.backdropAttributes?.length
    || marketFilter?.starsOnly,
  );
  const shouldShowMarketSection = isMarketDataLoaded && (hasMarketGifts || hasMarketFilter || isMarketLoading);

  return (
    <Modal
      dialogRef={dialogRef}
      isOpen={isOpen}
      onClose={handleClose}
      className={styles.modal}
      contentClassName={styles.content}
      hasAbsoluteCloseButton
      isSlim
      isLowStackPriority
    >
      <h3 className={buildClassName(styles.title, shouldShowTitleBorder && styles.titleWithBorder)}>
        {lang('GiftCraftSelectTitle')}
      </h3>
      <div className={styles.wrapper}>
        <Loading className={buildClassName(styles.loading, !isLoading && styles.hidden)} />
        <InfiniteScroll
          ref={scrollerRef}
          className={buildClassName(styles.scrollContainer, isLoading && styles.hidden, 'custom-scroll')}
          items={viewportIds}
          onLoadMore={getMore}
          onScroll={handleScroll}
          itemSelector=".starGiftItem"
          noFastList
          noScrollRestore={isMarketJustUpdated}
          preloadBackwards={CRAFT_GIFTS_LIMIT}
        >
          {isOpen && !hasMyGifts && !shouldShowMarketSection && isDataLoaded && (
            <ResaleGiftsNotFound
              className={styles.notFound}
              description={lang('ResellGiftsNoFound')}
            />
          )}
          {isOpen && hasMyGifts && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{lang('GiftCraftSelectYourGifts')}</p>
              <div className={styles.giftsGrid}>
                {availableMyGifts.map((savedGift) => {
                  const chancePercent = savedGift.gift.type === 'starGiftUnique'
                    ? (savedGift.gift.craftChancePermille || 0) / 10
                    : 0;
                  const { backdrop } = getGiftAttributes(savedGift.gift) || {};
                  return (
                    <CraftGiftItem
                      key={`my-${getSavedGiftKey(savedGift)}`}
                      gift={savedGift.gift}
                      chancePercent={chancePercent}
                      chanceColor={backdrop?.centerColor}
                      observe={observe}
                      onClick={handleMyGiftClick}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {isOpen && shouldShowMarketSection && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>
                {lang('GiftCraftSelectMarketGifts', {
                  count: marketCraftableGiftsCount || 0 },
                { pluralValue: marketCraftableGiftsCount || 0 })}
              </p>
              <div ref={filtersSeparatorRef} />
              <GiftResaleFilters
                dialogRef={dialogRef}
                className={buildClassName(styles.filters, isFiltersStuck && styles.stuck)}
                filterType="craft"
              />
              <Transition
                className={styles.transitionWrapper}
                name="semiFade"
                activeKey={marketUpdateIteration}
              >
                {isMarketGiftsEmpty && (
                  <ResaleGiftsNotFound
                    className={styles.notFound}
                    description={lang('ResellGiftsNoFound')}
                    linkText={hasMarketFilter ? lang('ResellGiftsClearFilters') : undefined}
                    onLinkClick={hasMarketFilter ? handleResetMarketFilter : undefined}
                  />
                )}
                {hasMarketGifts && (
                  <div className={styles.giftsGrid}>
                    {availableMarketGifts.map((marketGift) => {
                      const chancePercent = (marketGift.craftChancePermille || 0) / 10;
                      const { backdrop } = getGiftAttributes(marketGift) || {};
                      return (
                        <CraftGiftItem
                          key={`market-${marketGift.id}`}
                          gift={marketGift}
                          chancePercent={chancePercent}
                          chanceColor={backdrop?.centerColor}
                          showPrice
                          observe={observe}
                          onClick={handleMarketGiftClick}
                        />
                      );
                    })}
                  </div>
                )}
              </Transition>
            </div>
          )}
        </InfiniteScroll>
      </div>
      {shouldShowMarketSection && (
        <Checkbox
          className={buildClassName(
            styles.starsOnlyToggle,
            wasStarsOnlyToggleShown && styles.starsOnlyToggleVisible,
          )}
          label={lang('GiftResaleStarsOnly')}
          checked={isStarsOnly}
          isRound
          onCheck={handleStarsOnlyChange}
        />
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const tabState = selectTabState(global);

  return {
    craftModal: tabState.giftCraftModal,
  };
})(GiftCraftSelectModal));
