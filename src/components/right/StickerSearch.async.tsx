import type { OwnProps } from './StickerSearch';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const StickerSearchAsync = (props: OwnProps) => {
  const { isActive } = props;
  const StickerSearch = useModuleLoader(Bundles.Extra, 'StickerSearch', !isActive);

  return StickerSearch ? <StickerSearch {...props} /> : <Loading />;
};

export default StickerSearchAsync;
