import type { OwnProps } from './GiftLockedModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftLockedModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftLockedModal = useModuleLoader(Bundles.Stars, 'GiftLockedModal', !modal);

  return GiftLockedModal ? <GiftLockedModal {...props} /> : undefined;
};

export default GiftLockedModalAsync;
