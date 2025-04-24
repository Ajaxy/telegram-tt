import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiDisallowedGifts,
  ApiPeer,
  ApiPremiumGiftCodeOption,
  ApiStarGiftRegular,
  ApiStarsAmount,
} from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { StarGiftCategory } from '../../../types';

import { STARS_CURRENCY_CODE } from '../../../config';
import { getUserFullName } from '../../../global/helpers';
import { getPeerTitle, isApiPeerChat, isApiPeerUser } from '../../../global/helpers/peers';
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
import StarGiftCategoryList from './StarGiftCategoryList';

import styles from './GiftModal.module.scss';

import StarsBackground from '../../../assets/stars-bg.png';

export type OwnProps = {
  modal: TabState['giftModal'];
};

export type GiftOption = ApiPremiumGiftCodeOption | ApiStarGiftRegular;

type StateProps = {
  boostPerSentGift?: number;
  starGiftsById?: Record<string, ApiStarGiftRegular>;
  starGiftIdsByCategory?: Record<StarGiftCategory, string[]>;
  starBalance?: ApiStarsAmount;
  peer?: ApiPeer;
  isSelf?: boolean;
  disallowedGifts?: ApiDisallowedGifts;
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
}) => {
  const {
    closeGiftModal,
  } = getActions();
  // eslint-disable-next-line no-null/no-null
  const dialogRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const giftHeaderRef = useRef<HTMLHeadingElement>(null);

  // eslint-disable-next-line no-null/no-null
  const scrollerRef = useRef<HTMLDivElement>(null);

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const user = peer && isApiPeerUser(peer) ? peer : undefined;
  const chat = peer && isApiPeerChat(peer) ? peer : undefined;

  const [selectedGift, setSelectedGift] = useState<GiftOption | undefined>();
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
      .filter((gift) => gift.users === 1 && gift.currency !== 'XTR');
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

  const isGiftScreen = Boolean(selectedGift);
  const shouldShowHeader = isGiftScreen || shouldShowMainScreenHeader;
  const isHeaderForStarGifts = isGiftScreen ? isGiftScreenHeaderForStarGifts : isMainScreenHeaderForStarGifts;

  useEffect(() => {
    if (!isOpen) {
      setShouldShowMainScreenHeader(false);
      setSelectedGift(undefined);
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

  const handleGiftClick = useLastCallback((gift: GiftOption) => {
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
        return Boolean(isLimited && !!upgradeStars);
      }

      return true;
    });

    return (
      <div className={styles.starGiftsContainer}>
        {starGiftsById && filteredGiftIds?.map((giftId) => {
          const gift = starGiftsById[giftId];
          return (
            <GiftItemStar
              key={giftId}
              gift={gift}
              observeIntersection={observeIntersection}
              onClick={handleGiftClick}
            />
          );
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

  const handleCloseButtonClick = useLastCallback(() => {
    if (isGiftScreen) {
      setSelectedGift(undefined);
      return;
    }
    closeGiftModal();
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

  const isBackButton = isGiftScreen;

  const buttonClassName = buildClassName(
    'animated-close-icon',
    isBackButton && 'state-back',
  );

  return (
    <Modal
      dialogRef={dialogRef}
      onClose={closeGiftModal}
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
      <div className={buildClassName(styles.header, !shouldShowHeader && styles.hiddenHeader)}>
        <Transition
          name="slideVerticalFade"
          activeKey={Number(isHeaderForStarGifts)}
          slideClassName={styles.headerSlide}
        >
          <h2 className={styles.commonHeaderText}>
            {lang(isHeaderForStarGifts ? (isSelf ? 'StarsGiftHeaderSelf' : 'StarsGiftHeader') : 'GiftPremiumHeader')}
          </h2>
        </Transition>
      </div>
      <Transition
        ref={transitionRef}
        className={styles.transition}
        name="pushSlide"
        activeKey={isGiftScreen ? 1 : 0}
      >
        {!isGiftScreen && renderMainScreen()}
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

  return {
    boostPerSentGift: global.appConfig?.boostsPerSentGift,
    starGiftsById: starGifts?.byId,
    starGiftIdsByCategory: starGifts?.idsByCategory,
    starBalance: stars?.balance,
    peer,
    isSelf,
    disallowedGifts: userFullInfo?.disallowedGifts,
  };
})(GiftModal));

function getCategoryKey(category: StarGiftCategory) {
  if (category === 'all') return -2;
  if (category === 'limited') return -1;
  if (category === 'stock') return 0;
  return category;
}
