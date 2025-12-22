import type { OwnProps } from './PaidReactionModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PaidReactionModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const PaidReactionModal = useModuleLoader(Bundles.Stars, 'PaidReactionModal', !modal);

  return PaidReactionModal ? <PaidReactionModal {...props} /> : undefined;
};

export default PaidReactionModalAsync;
