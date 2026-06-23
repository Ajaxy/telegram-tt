import type { OwnProps } from './MapModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MapModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const MapModal = useModuleLoader(Bundles.Extra, 'MapModal', !isOpen);

  return MapModal ? <MapModal {...props} /> : undefined;
};

export default MapModalAsync;
