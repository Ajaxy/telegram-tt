import type { HTMLProps, ReactNode } from 'react';
import React from 'react';
import type { TreeInformation, TreeItemIndex } from 'react-complex-tree';
import type { FC } from '../../../../../lib/teact/teact';

import styles from './TreeItemsContainer.module.scss';

type OwnProps = {
  children: ReactNode;
  containerProps: HTMLProps<any>;
  info: TreeInformation;
  depth: number;
  parentId: TreeItemIndex;
};

const TreeItemsContainer: FC<OwnProps> = ({ children }) => {
  return <div className={styles.container}>{children}</div>;
};

export default TreeItemsContainer;
