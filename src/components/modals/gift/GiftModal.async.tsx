import type { OwnProps } from './GiftModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const GiftModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftModal = useModuleLoader(Bundles.Stars, 'GiftModal', !modal);

  return GiftModal ? <GiftModal {...props} /> : undefined;
};

export default GiftModalAsync;
