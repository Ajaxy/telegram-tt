import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './MapModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MapModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const MapModal = useModuleLoader(Bundles.Extra, 'MapModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return MapModal ? <MapModal {...props} /> : undefined;
};

export default MapModalAsync;
