import { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiStarsAmount, ApiTonAmount } from '../../api/types';

import { TON_CURRENCY_CODE } from '../../config';
import { formatStarsAmount } from '../../global/helpers/payments';
import buildClassName from '../../util/buildClassName';
import { convertTonToUsd, formatCurrencyAsString } from '../../util/formatCurrency';
import { formatStarsAsIcon, formatTonAsIcon, NEXT_ARROW_REPLACEMENT } from '../../util/localization/format';

import useIsTopmostBalanceBarModal from '../../hooks/element/useIsTopmostBalanceBarModal';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import Link from './Link';

import styles from './ModalStarBalanceBar.module.scss';

export type OwnProps = {
  isModalOpen?: true;
  currency?: 'TON' | 'XTR';
  onCloseAnimationEnd?: () => void;
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

  const isTopmost = useIsTopmostBalanceBarModal(ref, Boolean(shouldRender && currentBalance));

  const handleGetMoreStars = useLastCallback(() => {
    openStarsBalanceModal(isTonMode ? { currency: 'TON' } : {});
  });

  if (!shouldRender || !currentBalance) {
    return undefined;
  }

  return (
    <div
      className={buildClassName(styles.root, !isTopmost && styles.hidden)}
      ref={ref}
    >
      <div>
        {currentBalance.currency === TON_CURRENCY_CODE ? (
          lang('ModalStarsBalanceBarDescription', {
            stars: formatTonAsIcon(lang, currentBalance.amount),
          }, {
            withNodes: true,
            withMarkdown: true,
          })
        ) : (
          lang('ModalStarsBalanceBarDescription', {
            stars: formatStarsAsIcon(lang, formatStarsAmount(lang, currentBalance)),
          }, {
            withNodes: true,
            withMarkdown: true,
          })
        )}
      </div>
      <div>
        {currentBalance.currency === TON_CURRENCY_CODE && Boolean(tonUsdRate) && (
          <div className={styles.tonInUsdDescription} style="color: var(--color-text-secondary)">
            {`≈ ${formatCurrencyAsString(
              convertTonToUsd(currentBalance.amount, tonUsdRate),
              'USD',
              lang.code,
            )}`}
          </div>
        )}
        {!isTonMode && (
          <Link className={styles.getMoreStarsLink} isPrimary onClick={handleGetMoreStars}>
            {lang('GetMoreStarsLinkText', undefined, {
              withNodes: true,
              specialReplacement: NEXT_ARROW_REPLACEMENT,
            })}
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
