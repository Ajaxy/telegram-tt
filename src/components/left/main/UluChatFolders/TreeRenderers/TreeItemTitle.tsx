import React from 'react';
import type { FC } from '../../../../../lib/teact/teact';

type OwnProps = {
  title: string;
};

const TreeItemTitle: FC<OwnProps> = ({ title }) => {
  return <span>{title}</span>;
};

export default TreeItemTitle;
