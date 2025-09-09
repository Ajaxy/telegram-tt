import type { FC } from '../../../../lib/teact/teact';
import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { TabState } from '../../../../global/types';

import { formatDateToString } from '../../../../util/dates/dateFormat';
import { formatCurrencyAsString } from '../../../../util/formatCurrency';
import { formatStarsAsIcon } from '../../../../util/localization/format';
import { getGiftAttributes } from '../../../common/helpers/gifts';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import Button from '../../../ui/Button';
import TableInfoModal, { type TableData } from '../../common/TableInfoModal';

import styles from './GiftInfoValueModal.module.scss';

export type OwnProps = {
  modal: TabState['giftInfoValueModal'];
};

const HEADER_STICKER_SIZE = 120;
const FOOTER_STICKER_SIZE = 24;

const GiftInfoValueModal: FC<OwnProps> = ({
  modal,
}) => {
  const { closeGiftInfoValueModal, openUrl, openGiftInMarket } = getActions();

  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const handleOpenFragment = useLastCallback(() => {
    if (modal?.valueInfo.fragmentListedUrl) {
      openUrl({ url: modal.valueInfo.fragmentListedUrl });
    }
  });

  const handleOpenTelegramMarket = useLastCallback(() => {
    if (modal?.gift) {
      openGiftInMarket({ gift: modal.gift });
    }
  });

  const modalData = useMemo(() => {
    if (!renderingModal) return undefined;

    const { gift, valueInfo } = renderingModal;
    const giftAttributes = getGiftAttributes(gift);

    if (!giftAttributes) return undefined;

    const header = (
      <div className={styles.header}>
        <AnimatedIconFromSticker
          className={styles.sticker}
          sticker={giftAttributes.model!.sticker}
          size={HEADER_STICKER_SIZE}
        />
        <Button
          pill
          size="tiny"
          fluid
          nonInteractive
        >
          {formatCurrencyAsString(valueInfo.value, valueInfo.currency, lang.code)}
        </Button>
        <div className={styles.description}>
          {lang('GiftValueDescription', { giftName: gift.title }, {
            withMarkdown: true,
            withNodes: true,
          })}
        </div>
      </div>
    );

    const tableData: TableData = [];

    tableData.push([
      lang('GiftValueTitleInitialSale'),
      formatDateToString(valueInfo.initialSaleDate * 1000, lang.code),
    ]);

    tableData.push([
      lang('GiftValueTitleInitialPrice'),
      <span className={styles.initialPrice}>
        {formatStarsAsIcon(lang, valueInfo.initialSaleStars, { className: styles.starIcon })}
        {' (~ '}
        {formatCurrencyAsString(valueInfo.initialSalePrice, valueInfo.currency, lang.code)}
        )
      </span>,
    ]);

    if (valueInfo.lastSaleDate) {
      tableData.push([
        lang('GiftValueTitleLastSale'),
        formatDateToString(valueInfo.lastSaleDate * 1000, lang.code),
      ]);
    }

    if (valueInfo.lastSalePrice) {
      tableData.push([
        lang('GiftValueTitleLastPrice'),
        formatCurrencyAsString(valueInfo.lastSalePrice, valueInfo.currency, lang.code),
      ]);
    }

    if (valueInfo.floorPrice) {
      tableData.push([
        lang('GiftValueTitleMinimumPrice'),
        formatCurrencyAsString(valueInfo.floorPrice, valueInfo.currency, lang.code),
      ]);
    }

    if (valueInfo.averagePrice) {
      tableData.push([
        lang('GiftValueTitleAveragePrice'),
        formatCurrencyAsString(valueInfo.averagePrice, valueInfo.currency, lang.code),
      ]);
    }

    const canBuyOnFragment = Boolean(valueInfo.fragmentListedUrl && valueInfo.fragmentListedCount);
    const canBuyOnTelegram = Boolean(valueInfo.listedCount && valueInfo.listedCount);
    const hasFooter = canBuyOnFragment || canBuyOnTelegram;

    const footer = hasFooter && (
      <div className={styles.footer}>
        {canBuyOnFragment && (
          <Button
            isText
            onClick={handleOpenFragment}
            noForcedUpperCase
            size="tiny"
          >
            {lang.number(valueInfo.fragmentListedCount!)}
            <AnimatedIconFromSticker
              className={styles.footerSticker}
              sticker={giftAttributes.model!.sticker}
              size={FOOTER_STICKER_SIZE}
            />
            {lang('GiftValueForSaleOnFragment')}
          </Button>
        )}

        {canBuyOnTelegram && (
          <Button
            isText
            noForcedUpperCase
            size="tiny"
            onClick={handleOpenTelegramMarket}
          >
            {lang.number(valueInfo.listedCount!)}
            <AnimatedIconFromSticker
              className={styles.footerSticker}
              sticker={giftAttributes.model!.sticker}
              size={FOOTER_STICKER_SIZE}
            />
            {lang('GiftValueForSaleOnTelegram')}
          </Button>
        )}
      </div>
    );

    return {
      header,
      tableData,
      footer,
    };
  }, [lang, renderingModal, handleOpenFragment, handleOpenTelegramMarket]);

  if (!modalData) return undefined;

  return (
    <TableInfoModal
      isOpen={isOpen}
      onClose={closeGiftInfoValueModal}
      header={modalData.header}
      tableData={modalData.tableData}
      footer={modalData.footer}
    />
  );
};

export default memo(GiftInfoValueModal);
