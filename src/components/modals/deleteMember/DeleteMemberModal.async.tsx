import type { OwnProps } from './DeleteMemberModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const DeleteMemberModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const DeleteMemberModal = useModuleLoader(Bundles.Extra, 'DeleteMemberModal', !modal);

  return DeleteMemberModal ? <DeleteMemberModal {...props} /> : undefined;
};

export default DeleteMemberModalAsync;
