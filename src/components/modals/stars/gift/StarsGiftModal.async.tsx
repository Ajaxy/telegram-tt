import type { OwnProps } from './StarsGiftModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const StarsGiftModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const StarsGiftModal = useModuleLoader(Bundles.Stars, 'StarsGiftModal', !modal);

  return StarsGiftModal ? <StarsGiftModal {...props} /> : undefined;
};

export default StarsGiftModalAsync;
