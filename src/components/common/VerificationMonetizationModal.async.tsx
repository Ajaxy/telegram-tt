import type { OwnProps } from './VerificationMonetizationModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const VerificationMonetizationModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const VerificationMonetizationModal = useModuleLoader(Bundles.Extra, 'VerificationMonetizationModal', !modal);

  return VerificationMonetizationModal ? <VerificationMonetizationModal {...props} /> : undefined;
};

export default VerificationMonetizationModalAsync;
