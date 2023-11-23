import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './ArchivedChats';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const UluInboxAsync: FC<OwnProps> = (props) => {
  const UluInboxChats = useModuleLoader(Bundles.Extra, 'UluInboxChats');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return UluInboxChats ? <UluInboxChats {...props} /> : <Loading />;
};

export default UluInboxAsync;
