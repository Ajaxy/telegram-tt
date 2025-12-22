import type { OwnProps } from './GiftDescriptionRemoveModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftDescriptionRemoveModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftDescriptionRemoveModal = useModuleLoader(Bundles.Stars, 'GiftDescriptionRemoveModal', !modal);

  return GiftDescriptionRemoveModal ? <GiftDescriptionRemoveModal {...props} /> : undefined;
};

export default GiftDescriptionRemoveModalAsync;
