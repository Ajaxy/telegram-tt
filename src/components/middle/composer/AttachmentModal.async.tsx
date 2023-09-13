import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './AttachmentModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AttachmentModalAsync: FC<OwnProps> = (props) => {
  const { attachments } = props;
  const AttachmentModal = useModuleLoader(Bundles.Extra, 'AttachmentModal', !attachments.length);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return AttachmentModal ? <AttachmentModal {...props} /> : undefined;
};

export default AttachmentModalAsync;
