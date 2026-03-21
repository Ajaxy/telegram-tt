import type { OwnProps } from './TwoFaCheckModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const TwoFaCheckModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const TwoFaCheckModal = useModuleLoader(Bundles.Extra, 'TwoFaCheckModal', !modal);

  return TwoFaCheckModal ? <TwoFaCheckModal {...props} /> : undefined;
};

export default TwoFaCheckModalAsync;
