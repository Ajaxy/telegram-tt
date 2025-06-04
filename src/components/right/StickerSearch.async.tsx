import type { FC } from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const StickerSearchAsync: FC = () => {
  const StickerSearch = useModuleLoader(Bundles.Extra, 'StickerSearch');

  return StickerSearch ? <StickerSearch /> : <Loading />;
};

export default StickerSearchAsync;
