import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiPeer,
  ApiPremiumGiftCodeOption,
  ApiStarGiftRegular,
  ApiStarsAmount,
} from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { StarGiftCategory } from '../../../types';

import { getPeerTitle, getUserFullName } from '../../../global/helpers';
import { isApiPeerChat, isApiPeerUser } from '../../../global/helpers/peers';
import { selectPeer } from '../../../global/selectors';
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
};

const AVATAR_SIZE = 100;
const INTERSECTION_THROTTLE = 200;
const SCROLL_THROTTLE = 200;

const runThrottledForScroll = throttle((cb) => cb(), SCROLL_THROTTLE, true);

const PremiumGiftModal: FC<OwnProps & StateProps> = ({
  modal,
  starGiftsById,
  starGiftIdsByCategory,
  starBalance,
  peer,
  isSelf,
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
  const [isHeaderHidden, setIsHeaderHidden] = useState(true);
  const [isHeaderForStarGifts, setIsHeaderForStarGifts] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<StarGiftCategory>('all');

  const oldLang = useOldLang();
  const lang = useLang();

  const filteredGifts = useMemo(() => {
    return renderingModal?.gifts?.sort((prevGift, gift) => prevGift.months - gift.months)
      .filter((gift) => gift.users === 1);
  }, [renderingModal]);

  const baseGift = useMemo(() => {
    return filteredGifts?.reduce((prev, gift) => (prev.amount < gift.amount ? prev : gift));
  }, [filteredGifts]);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: scrollerRef, throttleMs: INTERSECTION_THROTTLE, isDisabled: !isOpen });

  useEffect(() => {
    if (!isOpen) {
      setIsHeaderHidden(true);
      setSelectedGift(undefined);
      setSelectedCategory('all');
    }
  }, [isOpen]);

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (selectedGift) return;
    const currentTarget = e.currentTarget;

    runThrottledForScroll(() => {
      const { scrollTop } = currentTarget;

      setIsHeaderHidden(scrollTop <= 150);

      if (transitionRef.current && giftHeaderRef.current) {
        const { top: headerTop } = giftHeaderRef.current.getBoundingClientRect();
        const { top: transitionTop } = transitionRef.current.getBoundingClientRect();
        setIsHeaderForStarGifts(headerTop - transitionTop <= 0);
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
    setIsHeaderForStarGifts('id' in gift);
    setIsHeaderHidden(false);
  });

  function renderStarGifts() {
    return (
      <div className={styles.starGiftsContainer}>
        {starGiftsById && starGiftIdsByCategory?.[selectedCategory].map((giftId) => {
          const gift = starGiftsById[giftId];
          return (
            <GiftItemStar
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
    if (selectedGift) {
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
        {!isSelf && !chat && renderGiftPremiumHeader()}
        {!isSelf && !chat && renderGiftPremiumDescription()}
        {!isSelf && !chat && renderPremiumGifts()}

        {renderStarGiftsHeader()}
        {renderStarGiftsDescription()}
        <StarGiftCategoryList onCategoryChanged={onCategoryChanged} />
        <Transition
          name="zoomFade"
          activeKey={getCategoryKey(selectedCategory)}
          className={styles.starGiftsTransition}
        >
          {renderStarGifts()}
        </Transition>
      </div>
    );
  }

  const isBackButton = Boolean(selectedGift);

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
      <BalanceBlock className={styles.balance} balance={starBalance} />
      <div className={buildClassName(styles.header, isHeaderHidden && styles.hiddenHeader)}>
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
        activeKey={selectedGift ? 1 : 0}
      >
        {!selectedGift && renderMainScreen()}
        {selectedGift && renderingModal?.forPeerId && (
          <GiftSendingOptions gift={selectedGift} peerId={renderingModal.forPeerId} />
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

  return {
    boostPerSentGift: global.appConfig?.boostsPerSentGift,
    starGiftsById: starGifts?.byId,
    starGiftIdsByCategory: starGifts?.idsByCategory,
    starBalance: stars?.balance,
    peer,
    isSelf,
  };
})(PremiumGiftModal));

function getCategoryKey(category: StarGiftCategory) {
  if (category === 'all') return -2;
  if (category === 'limited') return -1;
  if (category === 'stock') return 0;
  return category;
}
