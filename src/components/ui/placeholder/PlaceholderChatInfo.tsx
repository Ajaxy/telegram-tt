import React, { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './PlaceholderChatInfo.module.scss';

const PlaceholderChatInfo = () => {
  return (
    <div className={styles.root}>
      <div className={buildClassName(styles.avatar, styles.animated)} />
      <div className={styles.info}>
        <div className={buildClassName(styles.title, styles.animated)} />
        <div className={buildClassName(styles.subtitle, styles.animated)} />
      </div>
    </div>
  );
};

export default memo(PlaceholderChatInfo);
