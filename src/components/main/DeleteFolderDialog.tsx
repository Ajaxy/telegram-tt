import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import useLang from '../../hooks/useLang';

import ConfirmDialog from '../ui/ConfirmDialog';

export type OwnProps = {
  deleteFolderDialogId?: number;
};

const DeleteFolderDialog: FC<OwnProps> = ({
  deleteFolderDialogId,
}) => {
  const { closeDeleteChatFolderModal, deleteChatFolder } = getActions();
  const lang = useLang();

  const handleDeleteFolderMessage = useCallback(() => {
    closeDeleteChatFolderModal();
    deleteChatFolder({ id: deleteFolderDialogId });
  }, [closeDeleteChatFolderModal, deleteChatFolder, deleteFolderDialogId]);

  return (
    <ConfirmDialog
      isOpen={deleteFolderDialogId !== undefined}
      onClose={closeDeleteChatFolderModal}
      text={lang('FilterDeleteAlert')}
      confirmLabel={lang('Delete')}
      confirmHandler={handleDeleteFolderMessage}
      confirmIsDestructive
    />
  );
};

export default memo(DeleteFolderDialog);
