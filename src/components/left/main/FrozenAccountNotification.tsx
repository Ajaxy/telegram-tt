import { memo } from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';

import styles from './FrozenAccountNotification.module.scss';

type OwnProps = {
  onClick: () => void;
};

const FrozenAccountNotification = ({ onClick }: OwnProps) => {
  const lang = useLang();

  return (
    <div
      className={styles.root}
      onClick={onClick}
    >
      <div className={styles.title}>{lang('TitleFrozenAccount')}</div>
      <div className={styles.subtitle}>{lang('SubtitleFrozenAccount')}</div>
    </div>
  );
};

export default memo(FrozenAccountNotification);
