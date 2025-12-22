import type { OwnProps } from './DeleteFolderDialog';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const DeleteFolderDialogAsync = (props: OwnProps) => {
  const { folder } = props;
  const DeleteFolderDialog = useModuleLoader(Bundles.Extra, 'DeleteFolderDialog', !folder);

  return DeleteFolderDialog ? <DeleteFolderDialog {...props} /> : undefined;
};

export default DeleteFolderDialogAsync;
