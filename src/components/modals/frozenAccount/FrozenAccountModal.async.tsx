import type { OwnProps } from './FrozenAccountModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const FrozenAccountModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const FrozenAccountModal = useModuleLoader(Bundles.Extra, 'FrozenAccountModal', !modal);

  return FrozenAccountModal ? <FrozenAccountModal {...props} /> : undefined;
};

export default FrozenAccountModalAsync;
