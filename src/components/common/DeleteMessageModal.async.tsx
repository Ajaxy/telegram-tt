import React, { FC, memo } from '../../lib/teact/teact';
import { OwnProps } from './DeleteMessageModal';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const DeleteMessageModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const DeleteMessageModal = useModuleLoader(Bundles.Extra, 'DeleteMessageModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return DeleteMessageModal ? <DeleteMessageModal {...props} /> : undefined;
};

export default memo(DeleteMessageModalAsync);
