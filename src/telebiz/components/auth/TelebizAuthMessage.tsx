import { memo } from '@teact';

import LogoE from '../icons/LogoE';

import styles from './TelebizAuthMessage.module.scss';

const TelebizAuthMessage = () => {
  return (
    <div className={styles.authMessageWrapper}>
      <div className={styles.authMessage}>
        <div className={styles.authMessageLogo}>
          <LogoE />
        </div>
        <div className={styles.authMessageText}>
          Telebiz - Run your business on Telegram
          <br />
        </div>
      </div>
      <small>(Unofficial Telegram client)</small>
    </div>
  );
};

export default memo(TelebizAuthMessage);
