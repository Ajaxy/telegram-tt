import type { OwnProps } from './GifSearch';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const GifSearchAsync = (props: OwnProps) => {
  const { isActive } = props;
  const GifSearch = useModuleLoader(Bundles.Extra, 'GifSearch', !isActive);

  return GifSearch ? <GifSearch {...props} /> : <Loading />;
};

export default GifSearchAsync;
