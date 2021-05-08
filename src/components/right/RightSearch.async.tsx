import React, { FC, memo } from '../../lib/teact/teact';
import { OwnProps } from './RightSearch';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';
import Loading from '../ui/Loading';

const RightSearchAsync: FC<OwnProps> = (props) => {
  const RightSearch = useModuleLoader(Bundles.Extra, 'RightSearch');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return RightSearch ? <RightSearch {...props} /> : <Loading />;
};

export default memo(RightSearchAsync);
