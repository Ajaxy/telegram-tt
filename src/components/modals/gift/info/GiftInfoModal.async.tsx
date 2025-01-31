import type { FC } from '../../../../lib/teact/teact';
import React from '../../../../lib/teact/teact';

import type { OwnProps } from './GiftInfoModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftInfoModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const GiftInfoModal = useModuleLoader(Bundles.Stars, 'GiftInfoModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return GiftInfoModal ? <GiftInfoModal {...props} /> : undefined;
};

export default GiftInfoModalAsync;
