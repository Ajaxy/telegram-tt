import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './DeleteMessageModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const DeleteMessageModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const DeleteMessageModal = useModuleLoader(Bundles.Extra, 'DeleteMessageModal', !isOpen);

  return DeleteMessageModal ? <DeleteMessageModal {...props} /> : undefined;
};

export default DeleteMessageModalAsync;
