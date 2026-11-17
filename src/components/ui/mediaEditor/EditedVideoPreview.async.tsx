import type { OwnProps } from './EditedVideoPreview';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const EditedVideoPreviewAsync = (props: OwnProps) => {
  const EditedVideoPreview = useModuleLoader(Bundles.Extra, 'EditedVideoPreview');

  return EditedVideoPreview ? <EditedVideoPreview {...props} /> : undefined;
};

export default EditedVideoPreviewAsync;
