/* eslint-disable react/jsx-props-no-spreading */
import type { HTMLProps, ReactNode } from 'react';
import React from 'react';
import type { TreeInformation } from 'react-complex-tree';
import type { FC } from '../../../../../lib/teact/teact';

import buildClassName from '../../../../../util/buildClassName';

import chatFoldersWrapperStyles from '../../UluChatFoldersWrapper.module.scss';
import styles from './TreeContainer.module.scss';

type OwnProps = {
  children: ReactNode;
  containerProps: HTMLProps<any>;
  info: TreeInformation;
};

const TreeContainer: FC<OwnProps> = ({ children, containerProps }) => {
  const className = buildClassName(chatFoldersWrapperStyles.wrapper, styles.container);

  return (
    // @ts-ignore
    <div className={className} {...containerProps} style={{ maxHeight: '100%' }}>
      {children}
    </div>
  );
};

export default TreeContainer;
