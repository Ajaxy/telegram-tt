import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiChatFolder } from '../../api/types';

import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import ConfirmDialog from '../ui/ConfirmDialog';

export type OwnProps = {
  folder?: ApiChatFolder;
};

const DeleteFolderDialog: FC<OwnProps> = ({
  folder,
}) => {
  const { closeDeleteChatFolderModal, deleteChatFolder, openDeleteChatFolderModal } = getActions();
  const lang = useOldLang();

  const isOpen = Boolean(folder);

  const renderingFolder = usePreviousDeprecated(folder) || folder;
  const isMyChatlist = renderingFolder?.hasMyInvites;

  const handleDeleteFolderMessage = useCallback(() => {
    closeDeleteChatFolderModal();
    if (isMyChatlist) {
      openDeleteChatFolderModal({ folderId: renderingFolder!.id, isConfirmedForChatlist: true });
    } else {
      deleteChatFolder({ id: renderingFolder!.id });
    }
  }, [isMyChatlist, renderingFolder]);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={closeDeleteChatFolderModal}
      text={isMyChatlist ? lang('FilterDeleteAlertLinks') : lang('FilterDeleteAlert')}
      confirmLabel={lang('Delete')}
      confirmHandler={handleDeleteFolderMessage}
      confirmIsDestructive
    />
  );
};

export default memo(DeleteFolderDialog);
