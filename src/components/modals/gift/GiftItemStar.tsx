import React, { memo, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiStarGiftRegular,
} from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import { type ObserveFn, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import GiftRibbon from '../../common/gift/GiftRibbon';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import styles from './GiftItem.module.scss';

export type OwnProps = {
  gift: ApiStarGiftRegular;
  observeIntersection?: ObserveFn;
  onClick: (gift: ApiStarGiftRegular) => void;
};

const GIFT_STICKER_SIZE = 90;

function GiftItemStar({ gift, observeIntersection, onClick }: OwnProps) {
  const { openGiftInfoModal } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const lang = useLang();
  const [shouldPlay, play] = useFlag();

  const {
    stars,
    isLimited,
    isSoldOut,
    sticker,
  } = gift;

  const handleGiftClick = useLastCallback(() => {
    if (isSoldOut) {
      openGiftInfoModal({ gift });
      return;
    }

    onClick(gift);
  });

  useOnIntersect(ref, observeIntersection, (entry) => {
    if (entry.isIntersecting) play();
  });

  return (
    <div
      ref={ref}
      className={buildClassName(styles.container, styles.starGift)}
      tabIndex={0}
      role="button"
      onClick={handleGiftClick}
    >
      <AnimatedIconFromSticker
        sticker={sticker}
        noLoop
        play={shouldPlay}
        nonInteractive
        size={GIFT_STICKER_SIZE}
      />
      <Button className={styles.buy} nonInteractive size="tiny" color="stars" withSparkleEffect pill fluid>
        <Icon name="star" className={styles.star} />
        <div className={styles.amount}>
          {stars}
        </div>
      </Button>
      {isLimited && !isSoldOut && <GiftRibbon color="blue" text={lang('GiftLimited')} />}
      {isSoldOut && <GiftRibbon color="red" text={lang('GiftSoldOut')} />}
    </div>
  );
}

export default memo(GiftItemStar);
