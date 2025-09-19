import {
  memo, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TabState } from '../../../../global/types';

import { convertTonFromNanos, convertTonToNanos } from '../../../../util/formatCurrency';
import { convertTonToUsd, formatCurrencyAsString } from '../../../../util/formatCurrency';
import { formatStarsAsIcon, formatStarsAsText, formatTonAsIcon,
  formatTonAsText } from '../../../../util/localization/format';

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
  starsStargiftResaleCommissionPermille?: number;
  starsStargiftResaleAmountMin: number;
  starsStargiftResaleAmountMax?: number;
  starsUsdWithdrawRate?: number;
  tonStargiftResaleCommissionPermille?: number;
  tonStargiftResaleAmountMin: number;
  tonStargiftResaleAmountMax?: number;
  tonUsdRate?: number;
};

const GiftResalePriceComposerModal = ({
  modal, starsStargiftResaleCommissionPermille,
  starsStargiftResaleAmountMin, starsStargiftResaleAmountMax, starsUsdWithdrawRate,
  tonStargiftResaleCommissionPermille, tonStargiftResaleAmountMin, tonStargiftResaleAmountMax, tonUsdRate,
}: OwnProps & StateProps) => {
  const {
    closeGiftResalePriceComposerModal,
    closeGiftInfoModal,
    updateStarGiftPrice,
    showNotification,
  } = getActions();
  const isOpen = Boolean(modal);
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [isPriceInTon, setIsPriceInTon] = useState(false);

  const renderingModal = useCurrentOrPrev(modal);
  const { gift: typeGift } = renderingModal || {};
  const isSavedGift = typeGift && 'gift' in typeGift;
  const savedGift = isSavedGift ? typeGift : undefined;
  const hasPrice = Boolean(price);

  const lang = useLang();

  const handleChangePrice = useLastCallback((e) => {
    const value = e.target.value;
    const number = parseFloat(value);
    const maxAmount = isPriceInTon ? tonStargiftResaleAmountMax : starsStargiftResaleAmountMax;
    const result = value === '' || Number.isNaN(number) ? undefined
      : maxAmount ? Math.min(number, maxAmount) : number;
    setPrice(result);
  });

  const handleClose = useLastCallback(() => {
    closeGiftResalePriceComposerModal();
  });

  const handleSellGift = useLastCallback(() => {
    if (!savedGift || savedGift.gift.type !== 'starGiftUnique' || !savedGift.inputGift || !price) return;
    closeGiftResalePriceComposerModal();
    closeGiftInfoModal();
    updateStarGiftPrice(
      {
        gift: savedGift.inputGift,
        price: {
          currency: isPriceInTon ? 'TON' : 'XTR',
          amount: isPriceInTon ? convertTonToNanos(price) : price,
          nanos: 0,
        },
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
  const commission = isPriceInTon ? tonStargiftResaleCommissionPermille : starsStargiftResaleCommissionPermille;
  const minAmount = isPriceInTon ? tonStargiftResaleAmountMin : starsStargiftResaleAmountMin;
  const isPriceCorrect = hasPrice && price >= minAmount;

  return (
    <Modal
      isOpen={isOpen}
      title={isPriceInTon ? lang('PriceInTON') : lang('PriceInStars')}
      hasCloseButton
      isSlim
      onClose={handleClose}
    >
      <div className={styles.inputPrice}>
        <InputText
          label={isPriceInTon ? lang('EnterPriceInTon') : lang('EnterPriceInStars')}
          onChange={handleChangePrice}
          value={price?.toString()}
          inputMode="numeric"
          tabIndex={0}
          teactExperimentControlled={!isPriceInTon}
        />
      </div>

      <div className={styles.inputPriceDescription}>
        <span>
          {!isPriceCorrect && Boolean(commission) && lang('DescriptionComposerGiftMinimumPrice', {
            stars: isPriceInTon ? formatTonAsText(lang, minAmount) : formatStarsAsText(lang, minAmount),
          }, {
            withMarkdown: true,
            withNodes: true,
          })}
          {isPriceCorrect && (() => {
            const priceWithCommission = commission ? Number((price * commission).toFixed()) : price;
            return lang('DescriptionComposerGiftResalePrice',
              {
                stars: isPriceInTon
                  ? formatTonAsText(lang, priceWithCommission)
                  : formatStarsAsText(lang, priceWithCommission),
              },
              {
                withMarkdown: true,
                withNodes: true,
              });
          })()}
        </span>

        {isPriceCorrect && Boolean(isPriceInTon ? tonUsdRate : starsUsdWithdrawRate) && (
          <span className={styles.descriptionPrice}>
            {`≈ ${formatCurrencyAsString(
              isPriceInTon ? convertTonToUsd(price, tonUsdRate!) : price * starsUsdWithdrawRate!,
              'USD',
              lang.code,
            )}`}
          </span>
        )}
      </div>

      <Checkbox
        className={styles.checkBox}
        label={lang('OnlyAcceptTON')}
        checked={isPriceInTon}
        onCheck={setIsPriceInTon}
      />

      <div className={styles.checkBoxDescription}>
        {lang('OnlyAcceptTONDescription')}
      </div>

      <Button noForcedUpperCase disabled={!isPriceCorrect} onClick={handleSellGift}>
        {isPriceCorrect && lang('ButtonSellGift', {
          stars: isPriceInTon ? formatTonAsIcon(lang, price)
            : formatStarsAsIcon(lang, price, { asFont: true }),
        }, { withNodes: true })}
        {!isPriceCorrect && lang('Sell')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const configPermille = global.appConfig.starsStargiftResaleCommissionPermille;
    const starsStargiftResaleCommissionPermille = configPermille ? (configPermille / 1000) : undefined;
    const starsStargiftResaleAmountMin = global.appConfig.starsStargiftResaleAmountMin || 0;
    const starsStargiftResaleAmountMax = global.appConfig.starsStargiftResaleAmountMax;

    const starsUsdWithdrawRateX1000 = global.appConfig.starsUsdWithdrawRateX1000;
    const starsUsdWithdrawRate = starsUsdWithdrawRateX1000 ? starsUsdWithdrawRateX1000 / 1000 : 1;

    const tonConfigPermille = global.appConfig.tonStargiftResaleCommissionPermille;
    const tonStargiftResaleCommissionPermille = tonConfigPermille ? (tonConfigPermille / 1000) : 0;
    const tonStargiftResaleAmountMin = convertTonFromNanos(global.appConfig.tonStargiftResaleAmountMin || 0);
    const maxTonFromConfig = global.appConfig.tonStargiftResaleAmountMax;
    const tonStargiftResaleAmountMax = maxTonFromConfig && convertTonFromNanos(maxTonFromConfig);

    const tonUsdRate = global.appConfig.tonUsdRate;

    return {
      starsStargiftResaleCommissionPermille,
      starsStargiftResaleAmountMin,
      starsStargiftResaleAmountMax,
      starsUsdWithdrawRate,
      tonStargiftResaleCommissionPermille,
      tonStargiftResaleAmountMin,
      tonStargiftResaleAmountMax,
      tonUsdRate,
    };
  },
)(GiftResalePriceComposerModal));
