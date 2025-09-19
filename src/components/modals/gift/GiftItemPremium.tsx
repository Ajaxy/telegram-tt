import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type {
  ApiPremiumGiftCodeOption,
  ApiSticker,
} from '../../../api/types';

import {
  selectCanPlayAnimatedEmojis,
  selectGiftStickerForDuration,
} from '../../../global/selectors';
import { formatCurrencyAsString } from '../../../util/formatCurrency';
import { formatStarsAsIcon } from '../../../util/localization/format';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import GiftRibbon from '../../common/gift/GiftRibbon';
import Button from '../../ui/Button';

import styles from './GiftItem.module.scss';

export type OwnProps = {
  option: ApiPremiumGiftCodeOption;
  optionByStars?: ApiPremiumGiftCodeOption;
  baseMonthAmount?: number;
  onClick: (gift: ApiPremiumGiftCodeOption) => void;
};

export type StateProps = {
  sticker?: ApiSticker;
  canPlayAnimatedEmojis?: boolean;
};

const GIFT_STICKER_SIZE = 86;

function GiftItemPremium({
  sticker, canPlayAnimatedEmojis, baseMonthAmount, option, optionByStars, onClick,
}: OwnProps & StateProps) {
  const {
    months, amount, currency,
  } = option;
  const lang = useLang();

  const handleGiftClick = useLastCallback(() => {
    onClick(option);
  });

  const perMonth = Math.floor(amount / months);
  const discount = baseMonthAmount && baseMonthAmount > perMonth
    ? Math.ceil(100 - perMonth / (baseMonthAmount / 100))
    : undefined;

  function renderMonths() {
    const caption = months === 12
      ? lang('Years', { count: 1 }, { pluralValue: 1 })
      : lang('Months', { count: months }, { pluralValue: months });
    return (
      <div className={styles.monthsDescription}>
        {caption}
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      tabIndex={0}
      role="button"
      onClick={handleGiftClick}
    >
      <AnimatedIconFromSticker
        sticker={sticker}
        play={canPlayAnimatedEmojis}
        noLoop
        nonInteractive
        size={GIFT_STICKER_SIZE}
      />

      {renderMonths()}
      <div className={styles.description}>
        {lang('PremiumGiftDescription')}
      </div>
      <Button className={styles.buy} nonInteractive size="tiny" pill fluid>
        {formatCurrencyAsString(amount, currency)}
      </Button>
      {optionByStars && (
        <div className={styles.starsPriceBlock}>
          {lang('GiftPremiumStarsPrice', {
            stars: (formatStarsAsIcon(lang, optionByStars.amount, { className: styles.starsPriceIcon })),
          }, { withNodes: true, withMarkdown: true })}
        </div>
      )}
      {Boolean(discount) && (
        <GiftRibbon color="purple" text={lang('GiftDiscount', { percent: discount })} />
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { option }): Complete<StateProps> => {
    const sticker = selectGiftStickerForDuration(global, option.months);
    const canPlayAnimatedEmojis = selectCanPlayAnimatedEmojis(global);

    return {
      sticker,
      canPlayAnimatedEmojis,
    };
  },
)(GiftItemPremium));
