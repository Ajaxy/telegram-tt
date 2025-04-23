import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import styles from './FrozenAccountPlaceholder.module.scss';

function FrozenAccountPlaceholder() {
  const lang = useLang();

  const { openFrozenAccountModal } = getActions();

  const handleClick = useLastCallback(() => {
    openFrozenAccountModal();
  });

  return (
    <div
      className={styles.root}
      onClick={handleClick}
    >
      <div className={styles.title}>{lang('ComposerTitleFrozenAccount')}</div>
      <div className={styles.subtitle}>{lang('ComposerSubtitleFrozenAccount')}</div>
    </div>
  );
}

export default memo(FrozenAccountPlaceholder);
