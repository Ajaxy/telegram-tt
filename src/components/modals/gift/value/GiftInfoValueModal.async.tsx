import type { OwnProps } from './GiftInfoValueModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftInfoValueModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftInfoValueModal = useModuleLoader(Bundles.Stars, 'GiftInfoValueModal', !modal);

  return GiftInfoValueModal ? <GiftInfoValueModal {...props} /> : undefined;
};

export default GiftInfoValueModalAsync;
