import type { OwnProps } from './DeleteMessageModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const DeleteMessageModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const DeleteMessageModal = useModuleLoader(Bundles.Extra, 'DeleteMessageModal', !isOpen);

  return DeleteMessageModal ? <DeleteMessageModal {...props} /> : undefined;
};

export default DeleteMessageModalAsync;
