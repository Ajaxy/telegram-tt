import {
  memo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiStarsAmount } from '../../api/types';

import { formatStarsAmount } from '../../global/helpers/payments';
import buildClassName from '../../util/buildClassName';
import { formatStarsAsIcon } from '../../util/localization/format';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';

import Link from './Link';

import styles from './ModalStarBalanceBar.module.scss';

export type OwnProps = {
  onCloseAnimationEnd?: () => void;
  isModalOpen?: true;
};

export type StateProps = {
  starBalance?: ApiStarsAmount;
};

function ModalStarBalanceBar({
  starBalance,
  isModalOpen,
  onCloseAnimationEnd,
}: StateProps & OwnProps) {
  const {
    openStarsBalanceModal,
  } = getActions();

  const lang = useLang();
  const isOpen = isModalOpen ? Boolean(starBalance) : false;

  const {
    ref,
    shouldRender,
  } = useShowTransition({
    isOpen,
    onCloseAnimationEnd,
    withShouldRender: true,
  });

  const handleGetMoreStars = useLastCallback(() => {
    openStarsBalanceModal({});
  });

  if (!shouldRender || !starBalance) {
    return undefined;
  }

  return (
    <div
      className={buildClassName(styles.root)}
      ref={ref}
    >
      <div>
        {lang('ModalStarsBalanceBarDescription', {
          stars: formatStarsAsIcon(lang, formatStarsAmount(lang, starBalance), { className: styles.starIcon }),
        }, {
          withNodes: true,
          withMarkdown: true,
        })}
      </div>
      <div>
        <Link isPrimary onClick={handleGetMoreStars}>{lang('GetMoreStarsLinkText')}</Link>
      </div>
    </div>
  );
}

export default memo(withGlobal(
  (global): StateProps => {
    const {
      stars,
    } = global;

    return {
      starBalance: stars?.balance,
    };
  },
)(ModalStarBalanceBar));
