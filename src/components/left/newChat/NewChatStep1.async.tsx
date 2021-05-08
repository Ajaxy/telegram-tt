import React, { FC, memo } from '../../../lib/teact/teact';
import { Bundles } from '../../../util/moduleLoader';

import { OwnProps } from './NewChatStep1';

import useModuleLoader from '../../../hooks/useModuleLoader';
import Loading from '../../ui/Loading';

const NewChatStep1Async: FC<OwnProps> = (props) => {
  const NewChatStep1 = useModuleLoader(Bundles.Extra, 'NewChatStep1');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return NewChatStep1 ? <NewChatStep1 {...props} /> : <Loading />;
};

export default memo(NewChatStep1Async);
