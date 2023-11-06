import type { HTMLProps, ReactNode } from 'react';
import React from 'react';
import type { TreeInformation } from 'react-complex-tree';
import type { FC } from '../../../../../lib/teact/teact';

import chatFoldersWrapperStyles from '../../UluChatFoldersWrapper.module.scss';

type OwnProps = {
  children: ReactNode;
  containerProps: HTMLProps<any>;
  info: TreeInformation;
};

const TreeContainer: FC<OwnProps> = ({ children }) => {
  return (
    <div className={chatFoldersWrapperStyles.wrapper}>
      {children}
    </div>
  );
};

export default TreeContainer;
