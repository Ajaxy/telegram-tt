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
import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
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

import StarsBackground from '../../../assets/stars-bg.png';

export type OwnProps = {
  modal: TabState['giftModal'];
};

export type GiftOption = ApiPremiumGiftCodeOption | ApiStarGift;

type StateProps = {
  boostPerSentGift?: number;
  starGiftsById?: Record<string, ApiStarGiftRegular>;
  starGiftIdsByCategory?: Record<StarGiftCategory, string[]>;
  starBalance?: ApiStarsAmount;
  peer?: ApiPeer;
  isSelf?: boolean;
  disallowedGifts?: ApiDisallowedGifts;
  resaleGiftsCount?: number;
  areResaleGiftsLoading?: boolean;
};

const AVATAR_SIZE = 100;
const INTERSECTION_THROTTLE = 200;
const SCROLL_THROTTLE = 200;

const runThrottledForScroll = throttle((cb) => cb(), SCROLL_THROTTLE, true);

const GiftModal: FC<OwnProps & StateProps> = ({
  modal,
  starGiftsById,
  starGiftIdsByCategory,
  starBalance,
  peer,
  isSelf,
  disallowedGifts,
  resaleGiftsCount,
  areResaleGiftsLoading,
}) => {
  const {
    closeGiftModal, openGiftInfoModal, resetResaleGifts, loadResaleGifts,
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
  const [selectedResellGift, setSelectedResellGift] = useState<ApiStarGift | undefined>();
  const [shouldShowMainScreenHeader, setShouldShowMainScreenHeader] = useState(false);
  const [isMainScreenHeaderForStarGifts, setIsMainScreenHeaderForStarGifts] = useState(false);
  const [isGiftScreenHeaderForStarGifts, setIsGiftScreenHeaderForStarGifts] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<StarGiftCategory>('all');

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

  const isResaleScreen = Boolean(selectedResellGift) && !selectedGift;
  const isGiftScreen = Boolean(selectedGift);
  const shouldShowHeader = isResaleScreen || isGiftScreen || shouldShowMainScreenHeader;
  const isHeaderForStarGifts = isGiftScreen ? isGiftScreenHeaderForStarGifts : isMainScreenHeaderForStarGifts;

  useEffect(() => {
    if (selectedResellGift) {
      loadResaleGifts({ giftId: selectedResellGift.id });
    }
  }, [selectedResellGift]);

  useEffect(() => {
    if (!isOpen) {
      setShouldShowMainScreenHeader(false);
      setSelectedGift(undefined);
      setSelectedResellGift(undefined);
      setSelectedCategory('all');
    }
  }, [isOpen]);

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

  const starGiftDescription = chat
    ? lang('StarGiftDescriptionChannel', { peer: getPeerTitle(lang, chat) }, {
      withNodes: true,
      withMarkdown: true,
    })
    : isSelf
      ? lang('StarGiftDescriptionSelf', undefined, {
        withNodes: true,
        renderTextFilters: ['br'],
      })
      : lang('StarGiftDescription', {
        user: getUserFullName(user)!,
      }, { withNodes: true, withMarkdown: true });

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
      setSelectedResellGift(gift);
      return;
    }
    setSelectedGift(gift);
    setIsGiftScreenHeaderForStarGifts('id' in gift);
  });

  function renderStarGifts() {
    const filteredGiftIds = starGiftIdsByCategory?.[selectedCategory]?.filter((giftId) => {
      const gift = starGiftsById?.[giftId];
      if (!gift) return false;

      const { isLimited, isSoldOut, upgradeStars } = gift;
      if (areUnlimitedStarGiftsDisallowed && !areLimitedStarGiftsDisallowed) {
        return isLimited;
      }
      if (areLimitedStarGiftsDisallowed && !areUnlimitedStarGiftsDisallowed) {
        return !isLimited && !isSoldOut;
      }
      if (areUnlimitedStarGiftsDisallowed && areLimitedStarGiftsDisallowed) {
        return Boolean(isLimited && Boolean(upgradeStars));
      }

      return true;
    });

    return (
      <div className={styles.starGiftsContainer}>
        {starGiftsById && filteredGiftIds?.flatMap((giftId) => {
          const gift = starGiftsById[giftId];
          const shouldShowResale = selectedCategory !== 'stock' && Boolean(gift.availabilityResale);
          const shouldDuplicateAsResale = selectedCategory !== 'resale' && shouldShowResale && !gift.isSoldOut;

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
    setSelectedResellGift(undefined);
    resetResaleGifts();
    closeGiftModal();
  });

  const handleCloseButtonClick = useLastCallback(() => {
    if (isResaleScreen) {
      setSelectedResellGift(undefined);
      resetResaleGifts();
      return;
    }
    if (isGiftScreen) {
      setSelectedGift(undefined);
      return;
    }
    handleCloseModal();
  });

  function renderMainScreen() {
    return (
      <div ref={scrollerRef} className={buildClassName(styles.main, 'custom-scroll')} onScroll={handleScroll}>
        <div className={styles.avatars}>
          <Avatar
            size={AVATAR_SIZE}
            peer={peer}
          />
          <img className={styles.logoBackground} src={StarsBackground} alt="" draggable={false} />
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
              areLimitedStarGiftsDisallowed={areLimitedStarGiftsDisallowed}
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
            {selectedResellGift.title}
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
        {isResaleScreen && selectedResellGift
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

export default memo(withGlobal<OwnProps>((global, { modal }): StateProps => {
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

  return {
    boostPerSentGift: global.appConfig?.boostsPerSentGift,
    starGiftsById: starGifts?.byId,
    starGiftIdsByCategory: starGifts?.idsByCategory,
    starBalance: stars?.balance,
    peer,
    isSelf,
    disallowedGifts: userFullInfo?.disallowedGifts,
    resaleGiftsCount,
    areResaleGiftsLoading,
  };
})(GiftModal));

function getCategoryKey(category: StarGiftCategory) {
  if (category === 'all') return 0;
  if (category === 'limited') return 1;
  if (category === 'resale') return 2;
  if (category === 'stock') return 3;
  return category + 3;
}
