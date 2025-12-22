import type { OwnProps } from './GiftStatusInfoModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftStatusInfoModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftStatusInfoModal = useModuleLoader(Bundles.Stars, 'GiftStatusInfoModal', !modal);

  return GiftStatusInfoModal ? <GiftStatusInfoModal {...props} /> : undefined;
};

export default GiftStatusInfoModalAsync;
