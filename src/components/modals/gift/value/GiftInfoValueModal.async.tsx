import type { FC } from '../../../../lib/teact/teact';

import type { OwnProps } from './GiftInfoValueModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftInfoValueModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const GiftInfoValueModal = useModuleLoader(Bundles.Stars, 'GiftInfoValueModal', !modal);

  return GiftInfoValueModal ? <GiftInfoValueModal {...props} /> : undefined;
};

export default GiftInfoValueModalAsync;
