import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './VerificationMonetizationModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const VerificationMonetizationModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const VerificationMonetizationModal = useModuleLoader(Bundles.Extra, 'VerificationMonetizationModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return VerificationMonetizationModal ? <VerificationMonetizationModal {...props} /> : undefined;
};

export default VerificationMonetizationModalAsync;
