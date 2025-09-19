import {
  memo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiStarsAmount, ApiTonAmount } from '../../api/types';

import { formatStarsAmount } from '../../global/helpers/payments';
import buildClassName from '../../util/buildClassName';
import { convertTonFromNanos, convertTonToUsd, formatCurrencyAsString } from '../../util/formatCurrency';
import { formatStarsAsIcon, formatTonAsIcon } from '../../util/localization/format';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import Link from './Link';

import styles from './ModalStarBalanceBar.module.scss';

export type OwnProps = {
  onCloseAnimationEnd?: () => void;
  isModalOpen?: true;
  currency?: 'TON' | 'XTR';
};

export type StateProps = {
  starBalance?: ApiStarsAmount;
  tonBalance?: ApiTonAmount;
  tonUsdRate?: number;
};

function ModalStarBalanceBar({
  starBalance,
  tonBalance,
  tonUsdRate,
  isModalOpen,
  currency,
  onCloseAnimationEnd,
}: StateProps & OwnProps) {
  const {
    openStarsBalanceModal,
  } = getActions();

  const lang = useLang();
  const isTonMode = currency === 'TON';
  const currentBalance = isTonMode ? tonBalance : starBalance;
  const isOpen = isModalOpen ? Boolean(currentBalance) : false;

  const {
    ref,
    shouldRender,
  } = useShowTransition({
    isOpen,
    onCloseAnimationEnd,
    withShouldRender: true,
  });

  const handleGetMoreStars = useLastCallback(() => {
    openStarsBalanceModal(isTonMode ? { currency: 'TON' } : {});
  });

  if (!shouldRender || !currentBalance) {
    return undefined;
  }

  return (
    <div
      className={buildClassName(styles.root)}
      ref={ref}
    >
      <div>
        {isTonMode ? (
          lang('ModalStarsBalanceBarDescription', {
            stars: formatTonAsIcon(lang, convertTonFromNanos(currentBalance.amount), {
              className: styles.starIcon,
            }),
          }, {
            withNodes: true,
            withMarkdown: true,
          })
        ) : (
          lang('ModalStarsBalanceBarDescription', {
            stars: formatStarsAsIcon(lang, formatStarsAmount(lang, currentBalance as ApiStarsAmount), {
              className: styles.starIcon,
            }),
          }, {
            withNodes: true,
            withMarkdown: true,
          })
        )}
      </div>
      <div>
        {isTonMode && Boolean(tonUsdRate) && (
          <div className={styles.tonInUsdDescription} style="color: var(--color-text-secondary)">
            {`≈ ${formatCurrencyAsString(
              convertTonToUsd((currentBalance as ApiTonAmount).amount, tonUsdRate, true),
              'USD',
              lang.code,
            )}`}
          </div>
        )}
        {!isTonMode && (
          <Link isPrimary onClick={handleGetMoreStars}>
            {lang('GetMoreStarsLinkText')}
          </Link>
        )}
      </div>
    </div>
  );
}

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const {
      stars,
      ton,
    } = global;

    return {
      starBalance: stars?.balance,
      tonBalance: ton?.balance,
      tonUsdRate: global.appConfig.tonUsdRate,
    };
  },
)(ModalStarBalanceBar));
