import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './LeftSearch';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const LeftSearchAsync: FC<OwnProps> = (props) => {
  const LeftSearch = useModuleLoader(Bundles.Extra, 'LeftSearch');

  return LeftSearch ? <LeftSearch {...props} /> : <Loading />;
};

export default LeftSearchAsync;
