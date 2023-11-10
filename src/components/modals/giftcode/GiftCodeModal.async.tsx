import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './GiftCodeModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const GiftCodeModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const GiftCodeModal = useModuleLoader(Bundles.Extra, 'GiftCodeModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return GiftCodeModal ? <GiftCodeModal {...props} /> : undefined;
};

export default GiftCodeModalAsync;
