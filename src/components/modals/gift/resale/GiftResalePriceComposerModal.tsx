import {
  memo, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TabState } from '../../../../global/types';

import { TON_CURRENCY_CODE } from '../../../../config';
import { buildStarsAmount } from '../../../../global/helpers/payments';
import { selectStarsGiftResaleCommission } from '../../../../global/selectors';
import {
  convertTonToUsd, formatCurrencyAsString, formatTonFromNanos, parseTonPrefixToNanos,
} from '../../../../util/formatCurrency';
import { formatStarsAsIcon, formatStarsAsText, formatTonAsIcon,
  formatTonAsText } from '../../../../util/localization/format';
import { multiplyBigIntByPermille } from '../../../../util/numbers';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';
import Checkbox from '../../../ui/Checkbox';
import InputText from '../../../ui/InputText';
import Modal from '../../../ui/Modal';

import styles from './GiftResalePriceComposerModal.module.scss';

export type OwnProps = {
  modal: TabState['giftResalePriceComposerModal'];
};

export type StateProps = {
  starsCommission?: number;
  starsResaleAmountMin: number;
  starsResaleAmountMax?: number;
  starsUsdWithdrawRate?: number;
  tonCommissionPermille?: number;
  tonResaleAmountMin: bigint;
  tonResaleAmountMax?: bigint;
  tonUsdRate?: number;
};

const GiftResalePriceComposerModal = ({
  modal, starsCommission,
  starsResaleAmountMin, starsResaleAmountMax, starsUsdWithdrawRate,
  tonCommissionPermille, tonResaleAmountMin, tonResaleAmountMax, tonUsdRate,
}: OwnProps & StateProps) => {
  const {
    closeGiftResalePriceComposerModal,
    closeGiftInfoModal,
    updateStarGiftPrice,
    showNotification,
  } = getActions();
  const isOpen = Boolean(modal);
  // Kept as typed, so that a price in Grams turns into nanotons without a float in between
  const [priceText, setPriceText] = useState('');
  const [isPriceInTon, setIsPriceInTon] = useState(false);

  const renderingModal = useCurrentOrPrev(modal);
  const { gift: typeGift } = renderingModal || {};
  const isSavedGift = typeGift && 'gift' in typeGift;
  const savedGift = isSavedGift ? typeGift : undefined;
  const tonPrice = parseTonPrefixToNanos(priceText);
  const starsPrice = Number(priceText) || 0;
  const hasPrice = isPriceInTon ? tonPrice > 0n : starsPrice > 0;

  const lang = useLang();

  const handleChangePrice = useLastCallback((e) => {
    const value: string = e.target.value;

    if (isPriceInTon) {
      const isAboveMax = tonResaleAmountMax !== undefined && parseTonPrefixToNanos(value) > tonResaleAmountMax;
      setPriceText(isAboveMax ? formatTonFromNanos(tonResaleAmountMax) : value);
      return;
    }

    const number = parseFloat(value);
    const result = value === '' || Number.isNaN(number) ? undefined
      : starsResaleAmountMax ? Math.min(number, starsResaleAmountMax) : number;
    setPriceText(result?.toString() ?? '');
  });

  const handleClose = useLastCallback(() => {
    closeGiftResalePriceComposerModal();
  });

  const handleSellGift = useLastCallback(() => {
    if (!savedGift || savedGift.gift.type !== 'starGiftUnique' || !savedGift.inputGift || !hasPrice) return;
    closeGiftResalePriceComposerModal();
    closeGiftInfoModal();
    updateStarGiftPrice(
      {
        gift: savedGift.inputGift,
        price: isPriceInTon
          ? { currency: TON_CURRENCY_CODE, amount: tonPrice }
          : buildStarsAmount(starsPrice),
      });
    showNotification({
      icon: 'sell-outline',
      message: {
        key: 'NotificationGiftIsSale',
        variables: {
          gift: lang('GiftUnique', { title: savedGift.gift.title, number: savedGift.gift.number }),
        },
      },
    });
  });
  const hasCommission = Boolean(isPriceInTon ? tonCommissionPermille : starsCommission);
  const isPriceCorrect = hasPrice
    && (isPriceInTon ? tonPrice >= tonResaleAmountMin : starsPrice >= starsResaleAmountMin);

  return (
    <Modal
      isOpen={isOpen}
      title={isPriceInTon ? lang('PriceInGram') : lang('PriceInStars')}
      hasCloseButton
      isSlim
      onClose={handleClose}
    >
      <div className={styles.inputPrice}>
        <InputText
          label={isPriceInTon ? lang('EnterPriceInGram') : lang('EnterPriceInStars')}
          onChange={handleChangePrice}
          value={priceText}
          inputMode="numeric"
          tabIndex={0}
          teactExperimentControlled={!isPriceInTon}
        />
      </div>

      <div className={styles.inputPriceDescription}>
        <span>
          {!isPriceCorrect && hasCommission && lang('DescriptionComposerGiftMinimumPrice', {
            stars: isPriceInTon
              ? formatTonAsText(lang, tonResaleAmountMin)
              : formatStarsAsText(lang, starsResaleAmountMin),
          }, {
            withMarkdown: true,
            withNodes: true,
          })}
          {isPriceCorrect && lang('DescriptionComposerGiftResalePrice',
            {
              stars: isPriceInTon
                ? formatTonAsText(lang, tonCommissionPermille
                  ? multiplyBigIntByPermille(tonPrice, tonCommissionPermille)
                  : tonPrice)
                : formatStarsAsText(lang, starsCommission
                  ? Number((starsPrice * starsCommission).toFixed())
                  : starsPrice),
            },
            {
              withMarkdown: true,
              withNodes: true,
            })}
        </span>

        {isPriceCorrect && Boolean(isPriceInTon ? tonUsdRate : starsUsdWithdrawRate) && (
          <span className={styles.descriptionPrice}>
            {`≈ ${formatCurrencyAsString(
              isPriceInTon ? convertTonToUsd(tonPrice, tonUsdRate!) : starsPrice * starsUsdWithdrawRate!,
              'USD',
              lang.code,
            )}`}
          </span>
        )}
      </div>

      <Checkbox
        className={styles.checkBox}
        label={lang('OnlyAcceptGram')}
        checked={isPriceInTon}
        onCheck={setIsPriceInTon}
      />

      <div className={styles.checkBoxDescription}>
        {lang('OnlyAcceptGramDescription')}
      </div>

      <Button inline noForcedUpperCase disabled={!isPriceCorrect} onClick={handleSellGift}>
        {isPriceCorrect && lang('ButtonSellGift', {
          stars: isPriceInTon ? formatTonAsIcon(lang, tonPrice)
            : formatStarsAsIcon(lang, starsPrice, { asFont: true }),
        }, { withNodes: true })}
        {!isPriceCorrect && lang('Sell')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const starsCommission = selectStarsGiftResaleCommission(global);
    const starsResaleAmountMin = global.appConfig.starsStargiftResaleAmountMin || 0;
    const starsResaleAmountMax = global.appConfig.starsStargiftResaleAmountMax;

    const starsUsdWithdrawRateX1000 = global.appConfig.starsUsdWithdrawRateX1000;
    const starsUsdWithdrawRate = starsUsdWithdrawRateX1000 ? starsUsdWithdrawRateX1000 / 1000 : 1;

    const tonCommissionPermille = global.appConfig.tonStargiftResaleCommissionPermille;
    const tonResaleAmountMin = global.appConfig.tonStargiftResaleAmountMin || 0n;
    const tonResaleAmountMax = global.appConfig.tonStargiftResaleAmountMax;

    const tonUsdRate = global.appConfig.tonUsdRate;

    return {
      starsCommission,
      starsResaleAmountMin,
      starsResaleAmountMax,
      starsUsdWithdrawRate,
      tonCommissionPermille,
      tonResaleAmountMin,
      tonResaleAmountMax,
      tonUsdRate,
    };
  },
)(GiftResalePriceComposerModal));
