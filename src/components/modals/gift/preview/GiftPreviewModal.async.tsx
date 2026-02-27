import type { OwnProps } from './GiftPreviewModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftPreviewModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftPreviewModal = useModuleLoader(Bundles.Stars, 'GiftPreviewModal', !modal);

  return GiftPreviewModal ? <GiftPreviewModal {...props} /> : undefined;
};

export default GiftPreviewModalAsync;
