import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const GifSearchAsync: FC = () => {
  const GifSearch = useModuleLoader(Bundles.Extra, 'GifSearch');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return GifSearch ? <GifSearch /> : <Loading />;
};

export default GifSearchAsync;
