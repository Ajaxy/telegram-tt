import type { OwnProps } from './WishSendModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const WishSendModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const WishSendModal = useModuleLoader(Bundles.Extra, 'WishSendModal', !isOpen);

  return WishSendModal ? <WishSendModal {...props} /> : undefined;
};

export default WishSendModalAsync;
