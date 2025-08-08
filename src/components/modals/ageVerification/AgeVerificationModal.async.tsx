import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import type { OwnProps } from './AgeVerificationModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AgeVerificationModalAsync: FC<OwnProps> = memo((props) => {
  const { modal } = props;

  const AgeVerificationModal = useModuleLoader(Bundles.Extra, 'AgeVerificationModal', !modal);

  return AgeVerificationModal ? <AgeVerificationModal {...props} /> : undefined;
});

export default AgeVerificationModalAsync;
