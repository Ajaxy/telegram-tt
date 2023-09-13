import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './DeleteFolderDialog';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const DeleteFolderDialogAsync: FC<OwnProps> = (props) => {
  const { folder } = props;
  const DeleteFolderDialog = useModuleLoader(Bundles.Extra, 'DeleteFolderDialog', !folder);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return DeleteFolderDialog ? <DeleteFolderDialog {...props} /> : undefined;
};

export default DeleteFolderDialogAsync;
