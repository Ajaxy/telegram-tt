import type { RefObject } from 'react';
import type { FC, TeactNode } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './UluChatFoldersWrapper.module.scss';

type OwnProps = { ref?: RefObject<HTMLDivElement>; children?: TeactNode; className?: string };

const UluChatFoldersWrapper: FC<OwnProps> = ({ ref, children, className }) => (
  <div ref={ref} className={buildClassName(styles.wrapper, className)}>
    { children }
  </div>
);

export default memo(UluChatFoldersWrapper);
