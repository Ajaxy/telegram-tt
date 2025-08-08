import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiTypeCurrencyAmount } from '../../../api/types';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../config';
import { formatStarsAmount } from '../../../global/helpers/payments';
import buildClassName from '../../../util/buildClassName';
import { convertCurrencyFromBaseUnit } from '../../../util/formatCurrency';

import useLang from '../../../hooks/useLang';

import BadgeButton from '../../common/BadgeButton';
import Icon from '../../common/icons/Icon';
import StarIcon from '../../common/icons/StarIcon';

import styles from './StarsBalanceModal.module.scss';

type OwnProps = {
  balance?: ApiTypeCurrencyAmount;
  withAddButton?: boolean;
  className?: string;
};

const BalanceBlock = ({ balance, className, withAddButton }: OwnProps) => {
  const lang = useLang();

  const {
    openStarsBalanceModal,
  } = getActions();

  const renderStarsAmount = () => {
    return (
      <>
        <StarIcon type="gold" size="middle" />
        {balance !== undefined && balance.currency === STARS_CURRENCY_CODE
          ? formatStarsAmount(lang, balance) : '…'}
        {withAddButton && (
          <BadgeButton
            className={styles.addStarsButton}
            onClick={() => openStarsBalanceModal({})}
          >
            <Icon
              className={styles.addStarsIcon}
              name="add"
            />
          </BadgeButton>
        )}
      </>
    );
  };

  const renderTonAmount = () => {
    return (
      <>
        <Icon name="toncoin" />
        {balance !== undefined ? convertCurrencyFromBaseUnit(balance.amount, balance.currency) : '…'}
      </>
    );
  };

  return (
    <div className={buildClassName(styles.balanceBlock, className)}>
      <div className={styles.balanceInfo}>
        <span className={styles.smallerText}>{lang('StarsBalance')}</span>
        <div className={styles.balanceBottom}>
          {balance?.currency === TON_CURRENCY_CODE ? renderTonAmount() : renderStarsAmount()}
        </div>
      </div>
    </div>
  );
};

export default memo(BalanceBlock);
