import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';

import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString } from '../../../util/dates/dateFormat';
import { formatStarsAsIcon, formatStarsAsText } from '../../../util/localization/format';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import PremiumProgress from '../../common/PremiumProgress';
import Button from '../../ui/Button';
import TableInfoModal, { type TableData } from '../common/TableInfoModal';

import styles from './StarGiftPriceDecreaseInfoModal.module.scss';

export type OwnProps = {
  modal: TabState['starGiftPriceDecreaseInfoModal'];
};

const StarGiftPriceDecreaseInfoModal = ({ modal }: OwnProps) => {
  const { closeStarGiftPriceDecreaseInfoModal } = getActions();

  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const handleClose = useLastCallback(() => {
    closeStarGiftPriceDecreaseInfoModal();
  });

  const tableData = useMemo(() => {
    if (!renderingModal) return undefined;
    const { prices } = renderingModal;
    return prices.map((price): TableData[number] => [
      formatDateTimeToString(price.date * 1000, lang.code, true, undefined, true),
      formatStarsAsIcon(lang, price.upgradeStars, { containerClassName: styles.starIconContainer }),
    ]);
  }, [lang, renderingModal]);

  const footer = useMemo(() => {
    if (!isOpen) return undefined;
    return (
      <div className={styles.footer}>
        <p className={styles.footerText}>{lang('UpgradeCostDrops')}</p>
        <Button
          onClick={handleClose}
          iconName="understood"
          iconClassName={styles.understoodIcon}
        >
          {lang('ButtonUnderstood')}
        </Button>
      </div>
    );
  }, [lang, isOpen, handleClose]);

  if (!tableData || !renderingModal) return undefined;

  const { currentPrice, minPrice, maxPrice } = renderingModal;
  const progress = maxPrice !== minPrice ? (currentPrice - minPrice) / (maxPrice - minPrice) : 0;

  const header = (
    <div className={styles.header}>
      <PremiumProgress
        leftText={formatStarsAsText(lang, maxPrice)}
        rightText={formatStarsAsText(lang, minPrice)}
        floatingBadgeText={formatStarsAsText(lang, currentPrice)}
        floatingBadgeIcon="star"
        progress={progress}
        isInverted
        shouldSkipGradient
        className={styles.progress}
      />
      <p className={styles.headerTitle}>{lang('StarGiftUpgradeCostModalTitle')}</p>
      <p className={styles.headerHint}>{lang('StarGiftUpgradeCostHint')}</p>
    </div>
  );

  return (
    <TableInfoModal
      isOpen={isOpen}
      onClose={handleClose}
      header={header}
      tableData={tableData}
      tableClassName={buildClassName(styles.table, 'custom-scroll')}
      footer={footer}
    />
  );
};

export default memo(StarGiftPriceDecreaseInfoModal);
