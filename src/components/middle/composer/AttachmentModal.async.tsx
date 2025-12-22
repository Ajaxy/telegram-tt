import type { OwnProps } from './AttachmentModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AttachmentModalAsync = (props: OwnProps) => {
  const { attachments } = props;
  const AttachmentModal = useModuleLoader(Bundles.Extra, 'AttachmentModal', !attachments.length);

  return AttachmentModal ? <AttachmentModal {...props} /> : undefined;
};

export default AttachmentModalAsync;
