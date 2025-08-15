import { memo, useMemo, useRef, useState } from '@teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStarGift, ApiTypeCurrencyAmount } from '../../../api/types';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../config';
import { selectIsCurrentUserPremium } from '../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment.ts';
import buildClassName from '../../../util/buildClassName';
import { formatStarsAsIcon, formatTonAsIcon } from '../../../util/localization/format';
import { getGiftAttributes, getStickerFromGift } from '../../common/helpers/gifts';

import useFlag from '../../../hooks/useFlag.ts';
import { type ObserveFn, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import GiftRibbon from '../../common/gift/GiftRibbon';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import StickerView from '../../common/StickerView';
import Button from '../../ui/Button';

import styles from './GiftItem.module.scss';

export type OwnProps = {
  gift: ApiStarGift;
  observeIntersection?: ObserveFn;
  onClick: (gift: ApiStarGift, target: 'original' | 'resell') => void;
  isResale?: boolean;
};

type StateProps = {
  isCurrentUserPremium?: boolean;
};

const GIFT_STICKER_SIZE = 90;

function GiftItemStar({
  gift, observeIntersection, onClick, isResale, isCurrentUserPremium,
}: OwnProps & StateProps) {
  const { openGiftInfoModal, openPremiumModal, showNotification } = getActions();

  const ref = useRef<HTMLDivElement>();
  const stickerRef = useRef<HTMLDivElement>();

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
  const [isHover, markHover, unmarkHover] = useFlag();

  const sticker = getStickerFromGift(gift);
  const isGiftUnique = gift.type === 'starGiftUnique';
  const uniqueGift = isGiftUnique ? gift : undefined;
  const regularGift = !isGiftUnique ? gift : undefined;

  const priceInfo = !isGiftUnique
    ? { amount: regularGift?.stars || 0, currency: STARS_CURRENCY_CODE }
    : getPriceAmount(uniqueGift?.resellPrice);
  const priceCurrency = priceInfo?.currency || STARS_CURRENCY_CODE;
  const resellMinStars = regularGift?.resellMinStars;
  const priceInStarsAsString = !isGiftUnique && isResale && resellMinStars
    ? lang.number(resellMinStars) + '+' : priceInfo?.amount || 0;
  const isLimited = !isGiftUnique && Boolean(regularGift?.isLimited);
  const isSoldOut = !isGiftUnique && Boolean(regularGift?.isSoldOut);
  const isPremiumRequired = Boolean(gift?.requirePremium);
  const isUserLimitReached = Boolean(regularGift?.limitedPerUser && !regularGift?.perUserRemains);
  const perUserTotal = regularGift?.perUserTotal;

  const handleGiftClick = useLastCallback(() => {
    if (isSoldOut && !isResale) {
      openGiftInfoModal({ gift });
      return;
    }

    if (isUserLimitReached) {
      showNotification({
        message: lang('NotificationGiftsLimit', {
          count: perUserTotal,
        }, {
          withMarkdown: true,
          withNodes: true,
        }),
      });
      return;
    }

    if (isPremiumRequired && !isCurrentUserPremium) {
      openPremiumModal({
        gift,
      });
      return;
    }

    onClick(gift, isResale ? 'resell' : 'original');
  });

  const radialPatternBackdrop = useMemo(() => {
    const { backdrop, pattern } = getGiftAttributes(gift) || {};

    if (!backdrop || !pattern) {
      return undefined;
    }

    const backdropColors = [backdrop.centerColor, backdrop.edgeColor];
    const patternColor = backdrop.patternColor;

    return (
      <RadialPatternBackground
        className={styles.radialPattern}
        backgroundColors={backdropColors}
        patternColor={patternColor}
        patternIcon={pattern.sticker}
      />
    );
  }, [gift]);

  const giftNumber = isGiftUnique ? gift.number : 0;

  const giftRibbon = useMemo(() => {
    if (isGiftUnique) {
      const { backdrop } = getGiftAttributes(gift) || {};
      if (!backdrop) {
        return undefined;
      }
      return (
        <GiftRibbon
          color={[backdrop.centerColor, backdrop.edgeColor]}
          text={
            lang('GiftSavedNumber', { number: giftNumber })
          }
        />
      );
    }
    if (isPremiumRequired) {
      return <GiftRibbon color="orange" text={lang('LimitPremium')} />;
    }
    if (isResale) {
      return <GiftRibbon color="green" text={lang('GiftRibbonResale')} />;
    }
    if (isSoldOut) {
      return <GiftRibbon color="red" text={lang('GiftSoldOut')} />;
    }
    if (isLimited) {
      return <GiftRibbon color="blue" text={lang('GiftLimited')} />;
    }
    return undefined;
  }, [isGiftUnique, isResale, gift, isSoldOut, isLimited, lang, giftNumber, isPremiumRequired]);

  useOnIntersect(ref, observeIntersection, (entry) => {
    const visible = entry.isIntersecting;
    setIsVisible(visible);
  });

  return (
    <div
      ref={ref}
      className={buildClassName(
        'interactive-gift',
        styles.container,
        styles.starGift,
        'starGiftItem',
        isPremiumRequired && styles.premiumRequired,
      )}
      tabIndex={0}
      role="button"
      onClick={handleGiftClick}
      onMouseEnter={!IS_TOUCH_ENV ? markHover : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? unmarkHover : undefined}
    >
      {radialPatternBackdrop}

      <div
        ref={stickerRef}
        className={styles.stickerWrapper}
        style={`width: ${GIFT_STICKER_SIZE}px; height: ${GIFT_STICKER_SIZE}px`}
      >
        {sticker && (
          <StickerView
            observeIntersectionForPlaying={observeIntersection}
            observeIntersectionForLoading={observeIntersection}
            containerRef={stickerRef}
            sticker={sticker}
            size={GIFT_STICKER_SIZE}
            shouldLoop={isHover}
            shouldPreloadPreview
          />
        )}

      </div>
      <Button
        className={styles.buy}
        nonInteractive
        size="tiny"
        color={isGiftUnique ? 'bluredStarsBadge' : 'stars'}
        withSparkleEffect={isVisible}
        pill
        fluid
      >
        {priceCurrency === TON_CURRENCY_CODE
          ? formatTonAsIcon(lang, priceInStarsAsString || 0, { shouldConvertFromNanos: true, className: styles.star })
          : formatStarsAsIcon(lang, priceInStarsAsString || 0, { asFont: true, className: styles.star })}
      </Button>
      {giftRibbon}
    </div>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    return {
      isCurrentUserPremium,
    };
  })(GiftItemStar),
);
