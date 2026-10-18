import type { OwnProps } from './WishModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const WishModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const WishModal = useModuleLoader(Bundles.Extra, 'WishModal', !isOpen);

  return WishModal ? <WishModal {...props} /> : undefined;
};

export default WishModalAsync;
