import type { OwnProps } from './AiTonePreviewModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AiTonePreviewModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const AiTonePreviewModal = useModuleLoader(Bundles.Extra, 'AiTonePreviewModal', !modal);

  return AiTonePreviewModal ? <AiTonePreviewModal {...props} /> : undefined;
};

export default AiTonePreviewModalAsync;
