import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiPremiumGiftCodeOption,
  ApiStarGift,
  ApiUser,
} from '../../../api/types';
import type { StarGiftCategory, TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
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

export type GiftOption = ApiPremiumGiftCodeOption | ApiStarGift;

type StateProps = {
  boostPerSentGift?: number;
  starGiftsById?: Record<string, ApiStarGift>;
  starGiftCategoriesByName: Record<StarGiftCategory, string[]>;
  starBalance?: number;
  user?: ApiUser;
};

const PremiumGiftModal: FC<OwnProps & StateProps> = ({
  modal,
  starGiftsById,
  starGiftCategoriesByName,
  starBalance,
  user,
}) => {
  const {
    closeGiftModal, requestConfetti,
  } = getActions();
  // eslint-disable-next-line no-null/no-null
  const dialogRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const giftHeaderRef = useRef<HTMLHeadingElement>(null);

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

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

  const showConfetti = useLastCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      const {
        top, left, width, height,
      } = dialog.querySelector('.modal-content')!.getBoundingClientRect();
      requestConfetti({
        top,
        left,
        width,
        height,
        withStars: true,
      });
    }
  });

  useEffect(() => {
    if (renderingModal?.isCompleted) {
      showConfetti();
    }
  }, [renderingModal]);

  useEffect(() => {
    if (!isOpen) {
      setIsHeaderHidden(true);
      setSelectedGift(undefined);
    }
  }, [isOpen]);

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (selectedGift) return;

    const { scrollTop } = e.currentTarget;

    setIsHeaderHidden(scrollTop <= 150);

    if (transitionRef.current && giftHeaderRef.current) {
      const { top: headerTop } = giftHeaderRef.current.getBoundingClientRect();
      const { top: transitionTop } = transitionRef.current.getBoundingClientRect();
      setIsHeaderForStarGifts(headerTop - transitionTop <= 0);
    }
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

  const starGiftDescription = lang('StarGiftDescription', {
    user: getUserFullName(user)!,
  }, { withNodes: true });

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
        {lang('StarsGiftHeader')}
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
        {starGiftsById && starGiftCategoriesByName[selectedCategory].map((giftId) => {
          const gift = starGiftsById[giftId];
          return (
            <GiftItemStar
              gift={gift}
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
      <div className={buildClassName(styles.main, 'custom-scroll')} onScroll={handleScroll}>
        <div className={styles.avatars}>
          <Avatar
            size="huge"
            peer={user}
          />
          <img className={styles.logoBackground} src={StarsBackground} alt="" draggable={false} />
        </div>
        {renderGiftPremiumHeader()}
        {renderGiftPremiumDescription()}

        {renderPremiumGifts()}

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
            {lang(isHeaderForStarGifts ? 'StarsGiftHeader' : 'GiftPremiumHeader')}
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
        {selectedGift && renderingModal?.forUserId && (
          <GiftSendingOptions gift={selectedGift} userId={renderingModal.forUserId} />
        )}
      </Transition>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global, { modal }): StateProps => {
  const { starGiftsById, starGiftCategoriesByName, stars } = global;

  const user = modal?.forUserId ? selectUser(global, modal.forUserId) : undefined;

  return {
    boostPerSentGift: global.appConfig?.boostsPerSentGift,
    starGiftsById,
    starGiftCategoriesByName,
    starBalance: stars?.balance,
    user,
  };
})(PremiumGiftModal));

function getCategoryKey(category: StarGiftCategory) {
  if (category === 'all') {
    return -1;
  }
  if (category === 'limited') {
    return 0;
  }
  return category;
}
