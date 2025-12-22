import type { OwnProps } from './StarsBalanceModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StarsBalanceModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const StarsBalanceModal = useModuleLoader(Bundles.Stars, 'StarsBalanceModal', !modal);

  return StarsBalanceModal ? <StarsBalanceModal {...props} /> : undefined;
};

export default StarsBalanceModalAsync;
