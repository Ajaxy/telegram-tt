import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './DeleteAccountModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const DeleteAccountModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const DeleteAccountModal = useModuleLoader(Bundles.Extra, 'DeleteAccountModal', !modal);

  return DeleteAccountModal ? <DeleteAccountModal {...props} /> : undefined;
};

export default DeleteAccountModalAsync;
