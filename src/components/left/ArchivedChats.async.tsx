import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './ArchivedChats';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const ArchivedChatsAsync: FC<OwnProps> = (props) => {
  const ArchivedChats = useModuleLoader(Bundles.Extra, 'ArchivedChats');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ArchivedChats ? <ArchivedChats {...props} /> : <Loading />;
};

export default ArchivedChatsAsync;
