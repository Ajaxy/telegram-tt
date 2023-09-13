import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './NewChatStep1';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const NewChatStep1Async: FC<OwnProps> = (props) => {
  const NewChatStep1 = useModuleLoader(Bundles.Extra, 'NewChatStep1');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return NewChatStep1 ? <NewChatStep1 {...props} /> : <Loading />;
};

export default NewChatStep1Async;
