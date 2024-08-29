import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './StarGiftInfoModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StarGiftInfoModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const StarGiftInfoModal = useModuleLoader(Bundles.Extra, 'StarGiftInfoModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return StarGiftInfoModal ? <StarGiftInfoModal {...props} /> : undefined;
};

export default StarGiftInfoModalAsync;
