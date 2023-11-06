import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import styles from './UluChatFoldersDivider.module.scss';

const Divider: FC = () => {
  return <div className={styles.divider} />;
};

export default memo(Divider);
