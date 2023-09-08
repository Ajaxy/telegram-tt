import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';
import { Bundles } from '../../../util/moduleLoader';

import type { OwnProps } from './MapModal';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MapModalAsync: FC<OwnProps> = (props) => {
  const { geoPoint } = props;
  const MapModal = useModuleLoader(Bundles.Extra, 'MapModal', !geoPoint);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return MapModal ? <MapModal {...props} /> : undefined;
};

export default MapModalAsync;
