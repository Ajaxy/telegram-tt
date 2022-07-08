import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import type { OwnProps } from './DeleteFolderDialog';

import useModuleLoader from '../../hooks/useModuleLoader';

const DeleteFolderDialogAsync: FC<OwnProps> = (props) => {
  const { deleteFolderDialogId } = props;
  const DeleteFolderDialog = useModuleLoader(Bundles.Extra, 'DeleteFolderDialog', !deleteFolderDialogId);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return DeleteFolderDialog ? <DeleteFolderDialog {...props} /> : undefined;
};

export default memo(DeleteFolderDialogAsync);
