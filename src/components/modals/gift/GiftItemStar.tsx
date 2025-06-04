import { memo, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiStarGift,
} from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatStarsAsIcon } from '../../../util/localization/format';
import { getStickerFromGift } from '../../common/helpers/gifts';
import { getGiftAttributes } from '../../common/helpers/gifts';

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

const GIFT_STICKER_SIZE = 90;

function GiftItemStar({
  gift, observeIntersection, onClick, isResale,
}: OwnProps) {
  const { openGiftInfoModal } = getActions();

  const ref = useRef<HTMLDivElement>();
  const stickerRef = useRef<HTMLDivElement>();

  const lang = useLang();
  const [isVisible, setIsVisible] = useState(false);

  const sticker = getStickerFromGift(gift);
  const isGiftUnique = gift.type === 'starGiftUnique';
  const uniqueGift = isGiftUnique ? gift : undefined;
  const regularGift = !isGiftUnique ? gift : undefined;

  const stars = !isGiftUnique ? regularGift?.stars : uniqueGift?.resellPriceInStars;
  const resellMinStars = regularGift?.resellMinStars;
  const priceInStarsAsString = !isGiftUnique && isResale && resellMinStars
    ? lang.number(resellMinStars) + '+' : stars;
  const isLimited = !isGiftUnique && Boolean(regularGift?.isLimited);
  const isSoldOut = !isGiftUnique && Boolean(regularGift?.isSoldOut);

  const handleGiftClick = useLastCallback(() => {
    if (isSoldOut && !isResale) {
      openGiftInfoModal({ gift });
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
  }, [isGiftUnique, isResale, gift, isSoldOut, isLimited, lang, giftNumber]);

  useOnIntersect(ref, observeIntersection, (entry) => {
    const visible = entry.isIntersecting;
    setIsVisible(visible);
  });

  return (
    <div
      ref={ref}
      className={buildClassName(styles.container, styles.starGift, 'starGiftItem')}
      tabIndex={0}
      role="button"
      onClick={handleGiftClick}
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
        {formatStarsAsIcon(lang, priceInStarsAsString || 0, { asFont: true, className: styles.star })}
      </Button>
      {giftRibbon}
    </div>
  );
}

export default memo(GiftItemStar);
