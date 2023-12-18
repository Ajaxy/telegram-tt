import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './UluChatFoldersDivider.module.scss';

type OwnProps = {
  withBorder?: boolean;
};

const Divider: FC<OwnProps> = ({ withBorder = true }) => {
  const className = buildClassName(styles.divider, withBorder && styles['with-border']);

  return <div className={className} />;
};

export default memo(Divider);
