import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './WalletPendingClock.module.scss';

type OwnProps = {
  className?: string;
};

// Takes its size from the font size and its color from the text color
const WalletPendingClock = ({ className }: OwnProps) => {
  return (
    <div className={buildClassName(styles.root, className)} aria-hidden>
      <div className={buildClassName(styles.hand, styles.fastHand)} />
      <div className={buildClassName(styles.hand, styles.slowHand)} />
    </div>
  );
};

export default memo(WalletPendingClock);
