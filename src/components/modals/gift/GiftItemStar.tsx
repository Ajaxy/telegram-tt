import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiStarGift,
  ApiSticker,
} from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import GiftRibbon from '../../common/gift/GiftRibbon';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import styles from './GiftItem.module.scss';

export type OwnProps = {
  gift: ApiStarGift;
  onClick: (gift: ApiStarGift) => void;
};

export type StateProps = {
  sticker?: ApiSticker;
};

const GIFT_STICKER_SIZE = 90;

function GiftItemStar({ sticker, gift, onClick }: OwnProps & StateProps) {
  const { showNotification } = getActions();
  const lang = useLang();

  const {
    stars,
    isLimited,
    availabilityRemains,
    availabilityTotal,
  } = gift;

  const isSoldOut = availabilityTotal && !availabilityRemains;

  const handleGiftClick = useLastCallback(() => {
    if (isSoldOut) {
      showNotification({ message: lang('GiftSoldOutInfo') });
      return;
    }

    onClick(gift);
  });

  if (!sticker) return undefined;

  return (
    <div
      className={buildClassName(styles.container, styles.starGift)}
      tabIndex={0}
      role="button"
      onClick={handleGiftClick}
    >
      {isLimited && !isSoldOut && <GiftRibbon color="blue" text={lang('GiftLimited')} />}
      {isSoldOut && <GiftRibbon color="red" text={lang('GiftSoldOut')} />}
      <AnimatedIconFromSticker
        sticker={sticker}
        noLoop
        nonInteractive
        size={GIFT_STICKER_SIZE}
      />
      <Button className={styles.buy} nonInteractive size="tiny" color="stars" withSparkleEffect pill fluid>
        <Icon name="star" className={styles.star} />
        <div className={styles.amount}>
          {stars}
        </div>
      </Button>
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { gift }): StateProps => {
    const sticker = global.stickers.starGifts.stickers[gift.stickerId];

    return {
      sticker,
    };
  },
)(GiftItemStar));
