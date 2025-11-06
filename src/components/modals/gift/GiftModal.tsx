import type { FC } from '@teact';
import {
  memo, useEffect, useMemo, useRef, useState,
} from '@teact';
import type React from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiDisallowedGifts,
  ApiPeer,
  ApiPremiumGiftCodeOption,
  ApiSavedStarGift,
  ApiStarGift,
  ApiStarGiftRegular,
  ApiStarsAmount,
} from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { StarGiftCategory } from '../../../types';

import { STARS_CURRENCY_CODE } from '../../../config';
import { getUserFullName } from '../../../global/helpers';
import { getPeerTitle, isApiPeerChat, isApiPeerUser } from '../../../global/helpers/peers';
import { selectTabState } from '../../../global/selectors';
import { selectPeer, selectUserFullInfo } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { throttle } from '../../../util/schedulers';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import InteractiveSparkles from '../../common/InteractiveSparkles';
import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Modal from '../../ui/Modal';
import Transition from '../../ui/Transition';
import BalanceBlock from '../stars/BalanceBlock';
import GiftSendingOptions from './GiftComposer';
import GiftItemPremium from './GiftItemPremium';
import GiftItemStar from './GiftItemStar';
import GiftModalResaleScreen from './GiftModalResaleScreen';
import GiftResaleFilters from './GiftResaleFilters';
import StarGiftCategoryList from './StarGiftCategoryList';

import styles from './GiftModal.module.scss';

export type OwnProps = {
  modal: TabState['giftModal'];
};

export type GiftOption = ApiPremiumGiftCodeOption | ApiStarGift;

type StateProps = {
  boostPerSentGift?: number;
  starGiftsById?: Record<string, ApiStarGiftRegular>;
  starGiftIdsByCategory?: Record<StarGiftCategory, string[]>;
  myUniqueGiftsById?: Record<string, ApiSavedStarGift>;
  myUniqueGiftIds?: string[];
  starBalance?: ApiStarsAmount;
  peer?: ApiPeer;
  isSelf?: boolean;
  disallowedGifts?: ApiDisallowedGifts;
  resaleGiftsCount?: number;
  areResaleGiftsLoading?: boolean;
  selectedResaleGift?: ApiStarGift;
  tabId: number;
};

const AVATAR_SIZE = 100;
const INTERSECTION_THROTTLE = 200;
const SCROLL_THROTTLE = 200;
const AVATAR_SPARKLES_CENTER_SHIFT = [0, -50] as const;

const runThrottledForScroll = throttle((cb) => cb(), SCROLL_THROTTLE, true);

const GiftModal: FC<OwnProps & StateProps> = ({
  modal,
  starGiftsById,
  starGiftIdsByCategory,
  myUniqueGiftsById,
  myUniqueGiftIds,
  starBalance,
  peer,
  isSelf,
  disallowedGifts,
  resaleGiftsCount,
  areResaleGiftsLoading,
  selectedResaleGift,
  tabId,
}) => {
  const {
    closeGiftModal,
    openGiftInfoModal,
    resetResaleGifts,
    loadResaleGifts,
    openGiftInMarket,
    closeResaleGiftsMarket,
    loadMyUniqueGifts,
    openGiftTransferConfirmModal,
  } = getActions();
  const dialogRef = useRef<HTMLDivElement>();
  const transitionRef = useRef<HTMLDivElement>();
  const giftHeaderRef = useRef<HTMLHeadingElement>();

  const scrollerRef = useRef<HTMLDivElement>();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const user = peer && isApiPeerUser(peer) ? peer : undefined;
  const chat = peer && isApiPeerChat(peer) ? peer : undefined;

  const [selectedGift, setSelectedGift] = useState<GiftOption | undefined>();
  const [shouldShowMainScreenHeader, setShouldShowMainScreenHeader] = useState(false);
  const [isMainScreenHeaderForStarGifts, setIsMainScreenHeaderForStarGifts] = useState(false);
  const [isGiftScreenHeaderForStarGifts, setIsGiftScreenHeaderForStarGifts] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<StarGiftCategory>('all');
  const triggerSparklesRef = useRef<(() => void) | undefined>();

  const areAllGiftsDisallowed = useMemo(() => {
    if (!disallowedGifts) {
      return undefined;
    }
    const {
      shouldDisallowPremiumGifts,
      ...disallowedGiftTypes
    } = disallowedGifts;
    return !isSelf && Object.values(disallowedGiftTypes).every(Boolean);
  }, [isSelf, disallowedGifts]);

  const areUnlimitedStarGiftsDisallowed = !isSelf && disallowedGifts?.shouldDisallowUnlimitedStarGifts;
  const areLimitedStarGiftsDisallowed = !isSelf && disallowedGifts?.shouldDisallowLimitedStarGifts;
  const areUniqueStarGiftsDisallowed = !isSelf && disallowedGifts?.shouldDisallowUniqueStarGifts;

  const oldLang = useOldLang();
  const lang = useLang();
  const allGifts = renderingModal?.gifts;
  const filteredGifts = useMemo(() => {
    return allGifts?.sort((prevGift, gift) => prevGift.months - gift.months)
      .filter((gift) => gift.users === 1 && gift.currency !== STARS_CURRENCY_CODE);
  }, [allGifts]);

  const giftsByStars = useMemo(() => {
    const mapGifts = new Map();

    if (!filteredGifts) return mapGifts;

    filteredGifts.forEach((gift) => {
      const giftByStars = allGifts?.find(
        (starsGift) => starsGift.currency === STARS_CURRENCY_CODE
          && starsGift.months === gift.months,
      );
      if (giftByStars) {
        mapGifts.set(gift, giftByStars);
      }
    });

    return mapGifts;
  }, [allGifts, filteredGifts]);

  const baseGift = useMemo(() => {
    return filteredGifts?.reduce((prev, gift) => (prev.amount < gift.amount ? prev : gift));
  }, [filteredGifts]);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: scrollerRef, throttleMs: INTERSECTION_THROTTLE, isDisabled: !isOpen });

  const isResaleScreen = Boolean(selectedResaleGift) && !selectedGift;
  const isGiftScreen = Boolean(selectedGift);
  const shouldShowHeader = isResaleScreen || isGiftScreen || shouldShowMainScreenHeader;
  const isHeaderForStarGifts = isGiftScreen ? isGiftScreenHeaderForStarGifts : isMainScreenHeaderForStarGifts;

  useEffect(() => {
    if (selectedResaleGift) {
      const giftId = 'regularGiftId' in selectedResaleGift
        ? selectedResaleGift.regularGiftId
        : selectedResaleGift.id;
      loadResaleGifts({ giftId });
    }
  }, [selectedResaleGift]);

  useEffect(() => {
    if (!isOpen) {
      setShouldShowMainScreenHeader(false);
      setSelectedGift(undefined);
      setSelectedCategory('all');
    }
  }, [isOpen, tabId, closeResaleGiftsMarket]);

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isGiftScreen) return;
    const currentTarget = e.currentTarget;

    runThrottledForScroll(() => {
      const { scrollTop } = currentTarget;

      setShouldShowMainScreenHeader(scrollTop > 150);

      if (transitionRef.current && giftHeaderRef.current) {
        const { top: headerTop } = giftHeaderRef.current.getBoundingClientRect();
        const { top: transitionTop } = transitionRef.current.getBoundingClientRect();
        setIsMainScreenHeaderForStarGifts(headerTop - transitionTop <= 0);
      }
    });
  });

  const giftPremiumDescription = lang('GiftPremiumDescription', {
    user: getUserFullName(user)!,
    link: (
      <SafeLink
        text={lang('GiftPremiumDescriptionLinkCaption')}
        url={lang('GiftPremiumDescriptionLink')}
      />
    ),
  }, { withNodes: true });

  const starGiftDescription = useMemo(() => {
    if (chat) {
      return lang('StarGiftDescriptionChannel', { peer: getPeerTitle(lang, chat) }, {
        withNodes: true,
        withMarkdown: true,
      });
    }

    if (isSelf) {
      return lang('StarGiftDescriptionSelf', undefined, {
        withNodes: true,
        renderTextFilters: ['br'],
      });
    }

    if (selectedCategory === 'collectible') {
      return lang('StarGiftDescriptionCollectibles');
    }

    return lang('StarGiftDescription', {
      user: getUserFullName(user)!,
    }, { withNodes: true, withMarkdown: true });
  }, [chat, isSelf, selectedCategory, user, lang]);

  function renderGiftPremiumHeader() {
    return (
      <h2 className={buildClassName(styles.headerText, styles.center)}>
        {lang('GiftPremiumHeader')}
      </h2>
    );
  }

  function renderGiftPremiumDescription() {
    return (
      <p className={buildClassName(styles.description, styles.center)}>
        {giftPremiumDescription}
      </p>
    );
  }

  function renderStarGiftsHeader() {
    return (
      <h2 ref={giftHeaderRef} className={buildClassName(styles.headerText, styles.center)}>
        {lang(isSelf ? 'StarsGiftHeaderSelf' : 'StarsGiftHeader')}
      </h2>
    );
  }

  function renderStarGiftsDescription() {
    return (
      <p className={buildClassName(styles.description, styles.starGiftsDescription, styles.center)}>
        {starGiftDescription}
      </p>
    );
  }

  const handleGiftClick = useLastCallback((gift: GiftOption, target?: 'resell' | 'original') => {
    if (target === 'resell') {
      if (!('id' in gift)) {
        return;
      }
      if (isResaleScreen) {
        openGiftInfoModal({ gift, recipientId: renderingModal?.forPeerId });
        return;
      }
      openGiftInMarket({ gift, tabId });
      return;
    }
    setSelectedGift(gift);
    setIsGiftScreenHeaderForStarGifts('id' in gift);
  });

  const handleMyGiftClick = useLastCallback((gift: ApiStarGift) => {
    if (gift.type === 'starGift' || !myUniqueGiftsById || !peer?.id) return;
    const savedGift = myUniqueGiftsById[gift.id];

    openGiftTransferConfirmModal({
      gift: savedGift,
      recipientId: peer.id,
    });
  });

  const handleLoadMore = useLastCallback(() => {
    if (selectedCategory === 'myUnique') {
      loadMyUniqueGifts();
    }
  });

  function renderStarGifts() {
    if (selectedCategory === 'myUnique') {
      return (
        <InfiniteScroll
          className={styles.starGiftsContainer}
          items={myUniqueGiftIds}
          onLoadMore={handleLoadMore}
          scrollContainerClosest={`.${styles.main}`}
          itemSelector=".starGiftItem"
        >
          {myUniqueGiftsById && myUniqueGiftIds?.map((giftId) => {
            const savedGift = myUniqueGiftsById[giftId];
            if (!savedGift) return undefined;

            return (
              <GiftItemStar
                key={giftId}
                gift={savedGift.gift}
                observeIntersection={observeIntersection}
                onClick={handleMyGiftClick}
                withTransferBadge
              />
            );
          })}
        </InfiniteScroll>
      );
    }

    const filteredGiftIds = starGiftIdsByCategory?.[selectedCategory]?.filter((giftId) => {
      const gift = starGiftsById?.[giftId];
      if (!gift) return false;

      const { isLimited, availabilityResale } = gift;

      if (areLimitedStarGiftsDisallowed && isLimited) {
        return !areUniqueStarGiftsDisallowed ? availabilityResale : false;
      }

      if (areUnlimitedStarGiftsDisallowed && !isLimited) return false;

      return true;
    });

    return (
      <div className={styles.starGiftsContainer}>
        {starGiftsById && filteredGiftIds?.flatMap((giftId) => {
          const gift = starGiftsById[giftId];
          const shouldShowResale = Boolean(gift.availabilityResale) && !areUniqueStarGiftsDisallowed;
          const shouldDuplicateAsResale = shouldShowResale && !gift.isSoldOut && !areLimitedStarGiftsDisallowed;

          const elements = [
            <GiftItemStar
              key={giftId}
              gift={gift}
              observeIntersection={observeIntersection}
              isResale={shouldShowResale && !shouldDuplicateAsResale}
              onClick={handleGiftClick}
            />,
          ];

          if (shouldDuplicateAsResale) {
            elements.push(
              <GiftItemStar
                key={`resale_${giftId}`}
                isResale
                gift={gift}
                observeIntersection={observeIntersection}
                onClick={handleGiftClick}
              />,
            );
          }

          return elements;
        })}
      </div>
    );
  }

  function renderPremiumGifts() {
    return (
      <div className={styles.premiumGiftsGallery}>
        {filteredGifts?.map((gift) => {
          return (
            <GiftItemPremium
              option={gift}
              optionByStars={giftsByStars.get(gift)}
              baseMonthAmount={baseGift ? Math.floor(baseGift.amount / baseGift.months) : undefined}
              onClick={handleGiftClick}
            />
          );
        })}
      </div>
    );
  }

  const onCategoryChanged = useLastCallback((category: StarGiftCategory) => {
    setSelectedCategory(category);
  });

  const handleCloseModal = useLastCallback(() => {
    setSelectedGift(undefined);
    resetResaleGifts();
    closeGiftModal();
  });

  const handleCloseButtonClick = useLastCallback(() => {
    if (isResaleScreen) {
      closeResaleGiftsMarket({ tabId });
      return;
    }
    if (isGiftScreen) {
      setSelectedGift(undefined);
      return;
    }
    handleCloseModal();
  });

  const handleAvatarMouseMove = useLastCallback(() => {
    triggerSparklesRef.current?.();
  });

  const handleRequestAnimation = useLastCallback((animate: NoneToVoidFunction) => {
    triggerSparklesRef.current = animate;
  });

  function renderMainScreen() {
    return (
      <div ref={scrollerRef} className={buildClassName(styles.main, 'custom-scroll')} onScroll={handleScroll}>
        <div className={styles.avatars}>
          <Avatar
            className={styles.avatar}
            size={AVATAR_SIZE}
            peer={peer}
            onMouseMove={handleAvatarMouseMove}
          />
          <InteractiveSparkles
            className={styles.logoBackground}
            color="gold"
            centerShift={AVATAR_SPARKLES_CENTER_SHIFT}
            onRequestAnimation={handleRequestAnimation}
          />
        </div>
        {!isSelf && !chat && !disallowedGifts?.shouldDisallowPremiumGifts && (
          <>
            {renderGiftPremiumHeader()}
            {renderGiftPremiumDescription()}
            {renderPremiumGifts()}
          </>
        )}

        {!areAllGiftsDisallowed && (
          <>
            {renderStarGiftsHeader()}
            {renderStarGiftsDescription()}
            <StarGiftCategoryList
              areUniqueStarGiftsDisallowed={areUniqueStarGiftsDisallowed}
              areLimitedStarGiftsDisallowed={areLimitedStarGiftsDisallowed}
              isSelf={isSelf}
              hasMyUnique={Boolean(myUniqueGiftIds?.length)}
              onCategoryChanged={onCategoryChanged}
            />
            <Transition
              name="zoomFade"
              activeKey={getCategoryKey(selectedCategory)}
              className={styles.starGiftsTransition}
            >
              {renderStarGifts()}
            </Transition>
          </>
        )}
      </div>
    );
  }

  const isBackButton = isGiftScreen || isResaleScreen;

  const buttonClassName = buildClassName(
    'animated-close-icon',
    isBackButton && 'state-back',
  );

  function renderHeader() {
    if (!shouldShowHeader) return undefined;
    if (isResaleScreen) {
      const isFirstLoading = areResaleGiftsLoading && !resaleGiftsCount;
      return (
        <div className={styles.resaleHeaderContentContainer}>
          <h2 className={styles.resaleHeaderText}>
            {selectedResaleGift.title}
          </h2>
          {isFirstLoading
            && (
              <div className={styles.resaleHeaderDescription}>
                {lang('Loading')}
              </div>
            )}
          {!isFirstLoading && resaleGiftsCount !== undefined
            && (
              <div className={styles.resaleHeaderDescription}>
                {lang('HeaderDescriptionResaleGifts', {
                  count: resaleGiftsCount,
                }, { withNodes: true, withMarkdown: true, pluralValue: resaleGiftsCount })}
              </div>
            )}
          <GiftResaleFilters dialogRef={dialogRef} />
        </div>
      );
    }
    return (
      <h2 className={styles.commonHeaderText}>
        {lang(isHeaderForStarGifts ? (isSelf ? 'StarsGiftHeaderSelf' : 'StarsGiftHeader') : 'GiftPremiumHeader')}
      </h2>
    );
  }

  return (
    <Modal
      dialogRef={dialogRef}
      onClose={handleCloseModal}
      isOpen={isOpen}
      isSlim
      contentClassName={styles.content}
      className={buildClassName(styles.modalDialog, styles.root)}
      isLowStackPriority
    >
      <Button
        className={styles.closeButton}
        round
        color="translucent"
        size="smaller"
        onClick={handleCloseButtonClick}
        ariaLabel={isBackButton ? oldLang('Common.Back') : oldLang('Common.Close')}
      >
        <div className={buttonClassName} />
      </Button>
      <BalanceBlock className={styles.balance} balance={starBalance} withAddButton />
      <div className={buildClassName(
        styles.header,
        isResaleScreen && styles.resaleHeader,
        !shouldShowHeader && styles.hiddenHeader)}
      >
        <Transition
          name="slideVerticalFade"
          activeKey={!shouldShowHeader ? 0 : isResaleScreen ? 1 : isHeaderForStarGifts ? 2 : 3}
          slideClassName={styles.headerSlide}
        >
          {renderHeader()}
        </Transition>
      </div>
      <Transition
        ref={transitionRef}
        className={styles.transition}
        name="pushSlide"
        activeKey={isGiftScreen ? 1 : isResaleScreen ? 2 : 0}
      >
        {!isGiftScreen && !isResaleScreen && renderMainScreen()}
        {isResaleScreen && selectedResaleGift
          && (
            <GiftModalResaleScreen
              onGiftClick={handleGiftClick}
            />
          )}
        {isGiftScreen && renderingModal?.forPeerId && (
          <GiftSendingOptions
            gift={selectedGift}
            giftByStars={giftsByStars.get(selectedGift)}
            peerId={renderingModal.forPeerId}
          />
        )}
      </Transition>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global, { modal }): Complete<StateProps> => {
  const {
    starGifts,
    stars,
    currentUserId,
  } = global;

  const peer = modal?.forPeerId ? selectPeer(global, modal.forPeerId) : undefined;
  const isSelf = Boolean(currentUserId && modal?.forPeerId === currentUserId);
  const userFullInfo = peer ? selectUserFullInfo(global, peer?.id) : undefined;

  const { resaleGifts } = selectTabState(global);
  const resaleGiftsCount = resaleGifts.count;
  const areResaleGiftsLoading = resaleGifts.isLoading !== false;
  const selectedResaleGift = modal?.selectedResaleGift;

  return {
    boostPerSentGift: global.appConfig.boostsPerSentGift,
    starGiftsById: starGifts?.byId,
    starGiftIdsByCategory: starGifts?.idsByCategory,
    myUniqueGiftsById: global.myUniqueGifts?.byId,
    myUniqueGiftIds: global.myUniqueGifts?.ids,
    starBalance: stars?.balance,
    peer,
    isSelf,
    disallowedGifts: userFullInfo?.disallowedGifts,
    resaleGiftsCount,
    areResaleGiftsLoading,
    selectedResaleGift,
    tabId: selectTabState(global).id,
  };
})(GiftModal));

function getCategoryKey(category: StarGiftCategory) {
  if (category === 'all') return 0;
  if (category === 'myUnique') return 1;
  return 2;
}
