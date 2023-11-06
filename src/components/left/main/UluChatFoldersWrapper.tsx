import type { FC, TeactNode } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './UluChatFoldersWrapper.module.scss';

type OwnProps = { children?: TeactNode; className?: string };

const UluChatFoldersWrapper: FC<OwnProps> = ({ children, className }) => (
  <div className={buildClassName(styles.wrapper, className)}>
    { children }
  </div>
);

export default memo(UluChatFoldersWrapper);
