import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const StickerSearchAsync: FC = () => {
  const StickerSearch = useModuleLoader(Bundles.Extra, 'StickerSearch');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return StickerSearch ? <StickerSearch /> : <Loading />;
};

export default StickerSearchAsync;
