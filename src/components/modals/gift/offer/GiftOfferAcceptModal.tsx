import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiPeer } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../../config';
import { getPeerTitle } from '../../../../global/helpers/peers';
import {
  selectPeer,
  selectStarsGiftResaleCommission,
} from '../../../../global/selectors';
import { convertTonToUsd, formatCurrencyAsString } from '../../../../util/formatCurrency';
import {
  formatCurrencyAmountAsText, formatStarsAsIcon, formatStarsAsText, formatTonAsIcon, formatTonAsText,
} from '../../../../util/localization/format';
import { round } from '../../../../util/math';
import { multiplyBigIntByPermille } from '../../../../util/numbers';
import { formatPercent } from '../../../../util/textFormat';
import { getGiftAttributes } from '../../../common/helpers/gifts';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import GiftTransferPreview from '../../../common/gift/GiftTransferPreview';
import GiftRarityBadge from '../../../common/GiftRarityBadge';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import TableInfo, { type TableData } from '../../common/TableInfo';

import styles from './GiftOfferAcceptModal.module.scss';

const PRICE_WARNING_THRESHOLD_PERCENT = 10;

export type OwnProps = {
  modal: TabState['giftOfferAcceptModal'];
};

type StateProps = {
  recipientPeer?: ApiPeer;
  starsCommission?: number;
  tonCommissionPermille?: number;
  starsUsdRate?: number;
  tonUsdRate?: number;
};

const GiftOfferAcceptModal = ({
  modal, recipientPeer, starsCommission, tonCommissionPermille, starsUsdRate, tonUsdRate,
}: OwnProps & StateProps) => {
  const {
    closeGiftOfferAcceptModal, acceptStarGiftOffer,
  } = getActions();
  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const renderingBuyerPeer = useCurrentOrPrev(recipientPeer);

  const handleConfirm = useLastCallback(() => {
    if (!renderingModal) return;

    acceptStarGiftOffer({ messageId: renderingModal.messageId });
    closeGiftOfferAcceptModal();
  });

  const giftAttributes = useMemo(() => {
    return renderingModal?.gift && getGiftAttributes(renderingModal.gift);
  }, [renderingModal?.gift]);

  const offerPrice = renderingModal?.price;
  const tonReceiveAmount = offerPrice?.currency === TON_CURRENCY_CODE
    ? (tonCommissionPermille !== undefined
      ? multiplyBigIntByPermille(offerPrice.amount, tonCommissionPermille)
      : offerPrice.amount)
    : undefined;
  const starsReceiveAmount = offerPrice?.currency === STARS_CURRENCY_CODE
    ? (starsCommission ? round(offerPrice.amount * starsCommission) : offerPrice.amount)
    : 0;

  const tableData: TableData = useMemo(() => {
    if (!giftAttributes) return [];

    const { model, backdrop, pattern } = giftAttributes;
    const data: TableData = [];

    if (model) {
      data.push([
        lang('GiftAttributeModel'),
        <span className={styles.attributeValue}>
          <span>{model.name}</span>
          <GiftRarityBadge rarity={model.rarity} />
        </span>,
      ]);
    }

    if (backdrop) {
      data.push([
        lang('GiftAttributeBackdrop'),
        <span className={styles.attributeValue}>
          <span>{backdrop.name}</span>
          <GiftRarityBadge rarity={backdrop.rarity} />
        </span>,
      ]);
    }

    if (pattern) {
      data.push([
        lang('GiftAttributeSymbol'),
        <span className={styles.attributeValue}>
          <span>{pattern.name}</span>
          <GiftRarityBadge rarity={pattern.rarity} />
        </span>,
      ]);
    }

    const gift = renderingModal?.gift;
    if (gift?.valueAmount && gift.valueCurrency) {
      const formattedValue = formatCurrencyAsString(gift.valueAmount, gift.valueCurrency, lang.code);
      data.push([
        lang('GiftInfoValue'),
        lang('GiftInfoValueAmount', { amount: formattedValue }),
      ]);
    }

    return data;
  }, [giftAttributes, lang, renderingModal?.gift]);

  const priceWarning = useMemo(() => {
    if (!renderingModal) return undefined;

    const { gift } = renderingModal;
    const { valueUsdAmount } = gift;
    const isReceiving = tonReceiveAmount !== undefined ? tonReceiveAmount > 0n : starsReceiveAmount > 0;
    if (!valueUsdAmount || valueUsdAmount <= 0 || !isReceiving) return undefined;

    const avgValueUsd = valueUsdAmount / 100;

    let receiveValueUsd: number;
    if (tonReceiveAmount !== undefined) {
      if (!tonUsdRate) return undefined;
      receiveValueUsd = convertTonToUsd(tonReceiveAmount, tonUsdRate) / 100;
    } else {
      if (!starsUsdRate) return undefined;
      receiveValueUsd = starsReceiveAmount * starsUsdRate / 100;
    }

    const isLower = avgValueUsd >= receiveValueUsd;
    const percent = isLower
      ? (1 - receiveValueUsd / avgValueUsd) * 100
      : (receiveValueUsd / avgValueUsd - 1) * 100;

    if (percent <= PRICE_WARNING_THRESHOLD_PERCENT) return undefined;

    return { percent, isLow: isLower };
  }, [renderingModal, tonReceiveAmount, starsReceiveAmount, tonUsdRate, starsUsdRate]);

  if (!renderingModal || !renderingBuyerPeer) return undefined;

  const { gift, price } = renderingModal;
  const giftName = lang('GiftUnique', { title: gift.title, number: gift.number });
  const buyerName = getPeerTitle(lang, renderingBuyerPeer);

  const formattedPrice = formatCurrencyAmountAsText(lang, price);
  const formattedReceiveAmountAsText = tonReceiveAmount !== undefined
    ? formatTonAsText(lang, tonReceiveAmount)
    : formatStarsAsText(lang, starsReceiveAmount);
  const formattedReceiveAmountAsIcon = tonReceiveAmount !== undefined
    ? formatTonAsIcon(lang, tonReceiveAmount)
    : formatStarsAsIcon(lang, starsReceiveAmount, { asFont: true });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={lang('GiftOfferAcceptTitle')}
      onClose={closeGiftOfferAcceptModal}
      confirmLabel={lang('GiftOfferAcceptButton', {
        amount: formattedReceiveAmountAsIcon,
      }, { withNodes: true })}
      confirmHandler={handleConfirm}
    >
      <GiftTransferPreview
        peer={renderingBuyerPeer}
        gift={gift}
      />
      <p className={styles.description}>
        {lang('GiftOfferAcceptText', {
          gift: giftName,
          user: buyerName,
          price: formattedPrice,
        }, { withNodes: true, withMarkdown: true })}
      </p>
      <p className={styles.receiveText}>
        {lang('GiftOfferAcceptReceive', {
          amount: formattedReceiveAmountAsText,
        }, { withNodes: true, withMarkdown: true })}
      </p>
      {Boolean(tableData.length) && (
        <TableInfo tableData={tableData} className={styles.table} />
      )}
      {priceWarning && (
        <p className={priceWarning.isLow ? styles.warning : styles.success}>
          {lang(priceWarning.isLow ? 'GiftOfferPriceLow' : 'GiftOfferPriceHigh', {
            percent: formatPercent(priceWarning.percent, 0),
            gift: gift.title,
          }, { withNodes: true, withMarkdown: true })}
        </p>
      )}
    </ConfirmDialog>
  );
};

export default memo(
  withGlobal<OwnProps>((global, { modal }): Complete<StateProps> => {
    const recipientPeer = modal?.peerId ? selectPeer(global, modal.peerId) : undefined;
    const starsCommission = selectStarsGiftResaleCommission(global);
    const tonCommissionPermille = global.appConfig?.tonStargiftResaleCommissionPermille;

    const starsUsdSellRateX1000 = global.appConfig?.starsUsdSellRateX1000;
    const starsUsdRate = starsUsdSellRateX1000 ? starsUsdSellRateX1000 / 1000 : undefined;
    const tonUsdRate = global.appConfig?.tonUsdRate;

    return {
      recipientPeer,
      starsCommission,
      tonCommissionPermille,
      starsUsdRate,
      tonUsdRate,
    };
  })(GiftOfferAcceptModal),
);
