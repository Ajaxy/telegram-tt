import type { TeactNode } from '../../../lib/teact/teact';

import Transition from '../../ui/Transition';

import styles from './WalletNoticeScreen.module.scss';

type OwnProps = {
  sticker: TeactNode;
  title: TeactNode;
  subtitle?: TeactNode;
  text?: TeactNode;
  heroKey?: number;
  children?: TeactNode;
};

type ActionsOwnProps = {
  children: TeactNode;
};

const WalletNoticeScreen = ({
  sticker, title, subtitle, text, heroKey = 0, children,
}: OwnProps) => {
  return (
    <div className={styles.root}>
      <Transition
        name="fade"
        activeKey={heroKey}
        shouldCleanup
        className={styles.hero}
        slideClassName={styles.heroSlide}
      >
        <div className={styles.sticker}>{sticker}</div>
        <div className={styles.heading}>
          <div className={styles.title}>{title}</div>
          {Boolean(subtitle) && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
      </Transition>
      {Boolean(text) && <div className={styles.text}>{text}</div>}
      {children}
    </div>
  );
};

const WalletNoticeActions = ({ children }: ActionsOwnProps) => {
  return <div className={styles.actions}>{children}</div>;
};

export default WalletNoticeScreen;
export { WalletNoticeActions };
