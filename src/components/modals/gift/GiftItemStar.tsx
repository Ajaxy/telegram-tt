import { memo, useMemo, useRef, useState } from '@teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStarGift, ApiTypeCurrencyAmount } from '../../../api/types';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../config';
import { selectIsCurrentUserPremium } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatStarsAsIcon, formatTonAsIcon } from '../../../util/localization/format';
import { getGiftAttributes, getStickerFromGift } from '../../common/helpers/gifts';

import { type ObserveFn, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import GiftRibbon from '../../common/gift/GiftRibbon';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import GiftAttributeItem from './GiftAttributeItem';

import styles from './GiftItem.module.scss';

export type OwnProps = {
  gift: ApiStarGift;
  isResale?: boolean;
  withTransferBadge?: boolean;
  hideBadge?: boolean;
  noClickable?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: (gift: ApiStarGift, target: 'original' | 'resell') => void;
};

type StateProps = {
  isCurrentUserPremium?: boolean;
};

const GIFT_STICKER_SIZE = 90;

function GiftItemStar({
  gift, isResale, isCurrentUserPremium, withTransferBadge, hideBadge, noClickable, observeIntersection, onClick,
}: OwnProps & StateProps) {
  const {
    openGiftInfoModal, openPremiumModal, showNotification, checkCanSendGift, openGiftAuctionModal,
  } = getActions();

  const ref = useRef<HTMLDivElement>();

  function getPriceAmount(amounts?: ApiTypeCurrencyAmount[]) {
    if (!amounts) return { amount: 0, currency: STARS_CURRENCY_CODE };

    if (gift.type === 'starGiftUnique' && gift.resaleTonOnly) {
      const tonAmount = amounts.find((amount) => amount.currency === TON_CURRENCY_CODE);
      if (tonAmount) return tonAmount;
    }

    const starsAmount = amounts.find((amount) => amount.currency === STARS_CURRENCY_CODE);
    return starsAmount;
  }

  const lang = useLang();

  const [isVisible, setIsVisible] = useState(false);

  const sticker = getStickerFromGift(gift);
  const isGiftUnique = gift.type === 'starGiftUnique';
  const uniqueGift = isGiftUnique ? gift : undefined;
  const regularGift = !isGiftUnique ? gift : undefined;

  const priceInfo = !isGiftUnique
    ? { amount: regularGift?.stars || 0, currency: STARS_CURRENCY_CODE }
    : getPriceAmount(uniqueGift?.resellPrice);
  const priceCurrency = priceInfo?.currency || STARS_CURRENCY_CODE;
  const resellMinStars = regularGift?.resellMinStars;
  const formattedPrice = !isGiftUnique && isResale && resellMinStars
    ? lang.number(resellMinStars) + '+' : priceInfo?.amount || 0;
  const isLimited = !isGiftUnique && Boolean(regularGift?.isLimited);
  const isSoldOut = !isGiftUnique && Boolean(regularGift?.isSoldOut);
  const isAuction = !isGiftUnique && !isResale && Boolean(regularGift?.isAuction);
  const isPremiumRequired = Boolean(gift?.requirePremium);
  const isUserLimitReached = Boolean(regularGift?.limitedPerUser && !regularGift?.perUserRemains);
  const perUserTotal = regularGift?.perUserTotal;

  const handleGiftClick = useLastCallback(() => {
    if (isAuction) {
      openGiftAuctionModal({ gift });
      return;
    }

    if (isSoldOut && !isResale) {
      openGiftInfoModal({ gift });
      return;
    }

    if (isUserLimitReached) {
      showNotification({
        message: {
          key: 'NotificationGiftsLimit2',
          variables: {
            count: perUserTotal,
          },
          options: {
            pluralValue: perUserTotal!,
            withMarkdown: true,
            withNodes: true,
          },
        },
      });
      return;
    }

    if (isPremiumRequired && !isCurrentUserPremium) {
      openPremiumModal({
        gift,
      });
      return;
    }

    if (isLocked) {
      checkCanSendGift({
        gift,
        onSuccess: () => onClick?.(gift, isResale ? 'resell' : 'original'),
      });
      return;
    }

    onClick?.(gift, isResale ? 'resell' : 'original');
  });

  const giftAttrs = useMemo(() => getGiftAttributes(gift), [gift]);

  const giftNumber = isGiftUnique ? gift.number : 0;
  const isLocked = Boolean(gift.type === 'starGift' && gift.lockedUntilDate);

  const giftRibbon = useMemo(() => {
    if (isGiftUnique) {
      if (!giftAttrs?.backdrop) {
        return undefined;
      }
      return (
        <GiftRibbon
          color={[giftAttrs.backdrop.centerColor, giftAttrs.backdrop.edgeColor]}
          text={
            lang('GiftSavedNumber', { number: giftNumber })
          }
        />
      );
    }
    if (isResale) {
      return <GiftRibbon color="green" text={lang('GiftRibbonResale')} />;
    }
    if (isSoldOut) {
      return <GiftRibbon color="red" text={lang('GiftSoldOut')} />;
    }
    if (isAuction) {
      return <GiftRibbon color="orange" text={lang('GiftRibbonAuction')} />;
    }
    if (isPremiumRequired) {
      return <GiftRibbon color="orange" text={lang('GiftRibbonPremium')} />;
    }
    if (isLimited) {
      return <GiftRibbon color="blue" text={lang('GiftLimited')} />;
    }
    return undefined;
  }, [isGiftUnique, isResale, giftAttrs, isSoldOut,
    isLimited, lang, giftNumber, isPremiumRequired, isAuction]);

  useOnIntersect(ref, observeIntersection, (entry) => {
    const visible = entry.isIntersecting;
    setIsVisible(visible);
  });

  const badgeContent = useMemo(() => {
    if (withTransferBadge) {
      return lang('GiftTransferTitle');
    }

    if (isAuction) {
      return lang('GiftAuctionJoin');
    }

    if (priceCurrency === TON_CURRENCY_CODE) {
      return formatTonAsIcon(lang, formattedPrice || 0, {
        shouldConvertFromNanos: true,
        className: styles.star,
      });
    }

    return formatStarsAsIcon(lang, formattedPrice || 0, {
      asFont: true,
      className: styles.star,
    });
  }, [withTransferBadge, priceCurrency, formattedPrice, isAuction, lang]);

  return (
    <GiftAttributeItem
      ref={ref}
      backdrop={giftAttrs?.backdrop}
      patternSticker={giftAttrs?.pattern?.sticker}
      sticker={sticker}
      stickerSize={GIFT_STICKER_SIZE}
      observeIntersection={observeIntersection}
      className={buildClassName(
        'interactive-gift',
        styles.container,
        styles.starGift,
        'starGiftItem',
        isPremiumRequired && styles.premiumRequired,
        isAuction && styles.auction,
        noClickable && styles.noClickable,
      )}
      onClick={noClickable ? undefined : handleGiftClick}
    >
      {!hideBadge && (
        <Button
          className={buildClassName(
            styles.buy,
            withTransferBadge && styles.transferBadge,
          )}
          nonInteractive
          size="tiny"
          color={isGiftUnique ? 'bluredStarsBadge' : 'stars'}
          withSparkleEffect={isVisible && !withTransferBadge}
          pill
          fluid
          inline
        >
          {badgeContent}
        </Button>
      )}
      {giftRibbon}
      {isLocked && <Icon name="lock-badge" className={styles.lockIcon} />}
    </GiftAttributeItem>
  );
}

export default memo(
  withGlobal<OwnProps>((global): Complete<StateProps> => {
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    return {
      isCurrentUserPremium,
    };
  })(GiftItemStar),
);
