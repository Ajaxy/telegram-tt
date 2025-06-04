import React, {
  memo, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TabState } from '../../../../global/types';

import { formatCurrencyAsString } from '../../../../util/formatCurrency';
import { formatStarsAsIcon, formatStarsAsText } from '../../../../util/localization/format';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';
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
};

const GiftResalePriceComposerModal = ({
  modal, starsStargiftResaleCommissionPermille,
  starsStargiftResaleAmountMin, starsStargiftResaleAmountMax, starsUsdWithdrawRate,
}: OwnProps & StateProps) => {
  const {
    closeGiftResalePriceComposerModal,
    closeGiftInfoModal,
    updateStarGiftPrice,
    showNotification,
  } = getActions();
  const isOpen = Boolean(modal);
  const [price, setPrice] = useState<number | undefined>(undefined);

  const renderingModal = useCurrentOrPrev(modal);
  const { gift: typeGift } = renderingModal || {};
  const isSavedGift = typeGift && 'gift' in typeGift;
  const savedGift = isSavedGift ? typeGift : undefined;
  const hasPrice = Boolean(price);

  const lang = useLang();

  const handleChangePrice = useLastCallback((e) => {
    const value = e.target.value;
    const number = parseFloat(value);
    const result = value === '' || Number.isNaN(number) ? undefined
      : starsStargiftResaleAmountMax ? Math.min(number, starsStargiftResaleAmountMax) : number;
    setPrice(result);
  });

  const handleClose = useLastCallback(() => {
    closeGiftResalePriceComposerModal();
  });

  const handleSellGift = useLastCallback(() => {
    if (!savedGift || savedGift.gift.type !== 'starGiftUnique' || !savedGift.inputGift || !price) return;
    closeGiftResalePriceComposerModal();
    closeGiftInfoModal();
    updateStarGiftPrice({ gift: savedGift.inputGift, price });
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
  const commission = starsStargiftResaleCommissionPermille;
  const isPriceCorrect = hasPrice && price > starsStargiftResaleAmountMin;

  return (
    <Modal
      isOpen={isOpen}
      title={lang('GiftSellTitle')}
      hasCloseButton
      isSlim
      onClose={handleClose}
    >
      <div className={styles.inputPrice}>
        <InputText
          label={lang('InputPlaceholderGiftResalePrice')}
          onChange={handleChangePrice}
          value={price?.toString()}
          inputMode="numeric"
          tabIndex={0}
          teactExperimentControlled
        />
      </div>

      <div className={styles.descriptionContainer}>
        <span>
          {!isPriceCorrect && Boolean(commission) && lang('DescriptionComposerGiftMinimumPrice', {
            stars: formatStarsAsText(lang, starsStargiftResaleAmountMin),
          }, {
            withMarkdown: true,
            withNodes: true,
          })}
          {isPriceCorrect && lang('DescriptionComposerGiftResalePrice',
            {
              stars: formatStarsAsText(lang, commission ? Number((price * (commission)).toFixed()) : price),
            },
            {
              withMarkdown: true,
              withNodes: true,
            })}
        </span>

        {isPriceCorrect && Boolean(starsUsdWithdrawRate) && (
          <span className={styles.descriptionPrice}>
            {`≈ ${formatCurrencyAsString(
              price * starsUsdWithdrawRate,
              'USD',
              lang.code,
            )}`}
          </span>
        )}
      </div>

      <Button noForcedUpperCase disabled={!isPriceCorrect} size="smaller" onClick={handleSellGift}>
        {isPriceCorrect && lang('ButtonSellGift', {
          stars: formatStarsAsIcon(lang, price, { asFont: true }),
        }, { withNodes: true })}
        {!isPriceCorrect && lang('Sell')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const configPermille = global.appConfig?.starsStargiftResaleCommissionPermille;
    const starsStargiftResaleCommissionPermille = configPermille ? (configPermille / 1000) : undefined;
    const starsStargiftResaleAmountMin = global.appConfig?.starsStargiftResaleAmountMin || 0;
    const starsStargiftResaleAmountMax = global.appConfig?.starsStargiftResaleAmountMax;

    const starsUsdWithdrawRateX1000 = global.appConfig?.starsUsdWithdrawRateX1000;
    const starsUsdWithdrawRate = starsUsdWithdrawRateX1000 ? starsUsdWithdrawRateX1000 / 1000 : 1;

    return {
      starsStargiftResaleCommissionPermille,
      starsStargiftResaleAmountMin,
      starsStargiftResaleAmountMax,
      starsUsdWithdrawRate,
    };
  },
)(GiftResalePriceComposerModal));
