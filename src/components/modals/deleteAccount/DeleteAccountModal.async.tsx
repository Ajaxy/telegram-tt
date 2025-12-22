import type { OwnProps } from './DeleteAccountModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const DeleteAccountModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const DeleteAccountModal = useModuleLoader(Bundles.Extra, 'DeleteAccountModal', !modal);

  return DeleteAccountModal ? <DeleteAccountModal {...props} /> : undefined;
};

export default DeleteAccountModalAsync;
