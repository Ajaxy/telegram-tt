import React, {
  FC, useCallback, memo, useMemo, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiChatFolder } from '../../api/types';

import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import CheckboxGroup from '../ui/CheckboxGroup';

export type OwnProps = {
  isOpen: boolean;
  chatId: string;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
};

type StateProps = {
  foldersById?: Record<number, ApiChatFolder>;
  folderOrderedIds?: number[];
};

type DispatchProps = Pick<GlobalActions, 'editChatFolders'>;

const ChatFolderModal: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen,
  chatId,
  foldersById,
  folderOrderedIds,
  onClose,
  onCloseAnimationEnd,
  editChatFolders,
}) => {
  const lang = useLang();

  const initialSelectedFolderIds = useMemo(() => {
    if (!foldersById) {
      return [];
    }

    return Object.keys(foldersById).reduce((result, folderId) => {
      const { includedChatIds, pinnedChatIds } = foldersById[Number(folderId)];
      if (includedChatIds.includes(chatId) || pinnedChatIds?.includes(chatId)) {
        result.push(folderId);
      }

      return result;
    }, [] as string[]);
  }, [chatId, foldersById]);

  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>(initialSelectedFolderIds);

  const folders = useMemo(() => {
    return folderOrderedIds?.map((folderId) => ({
      label: foldersById ? foldersById[folderId].title : '',
      value: String(folderId),
    })) || [];
  }, [folderOrderedIds, foldersById]);

  const handleSubmit = useCallback(() => {
    const idsToRemove = initialSelectedFolderIds.filter((id) => !selectedFolderIds.includes(id));
    const idsToAdd = selectedFolderIds.filter((id) => !initialSelectedFolderIds.includes(id));

    editChatFolders({ chatId, idsToRemove, idsToAdd });
    onClose();
  }, [chatId, editChatFolders, initialSelectedFolderIds, onClose, selectedFolderIds]);

  if (!foldersById || !folderOrderedIds) {
    return undefined;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      onEnter={handleSubmit}
      className="delete"
      title={lang('FilterAddTo')}
    >
      {folders.length ? (
        <CheckboxGroup
          options={folders}
          selected={selectedFolderIds}
          onChange={setSelectedFolderIds}
          round
        />
      ) : 'You have no folders yet. You can create one from Setting->Folders->Create New Folder'}
      {!!folders.length && (
        <Button color="primary" className="confirm-dialog-button" isText onClick={handleSubmit}>
          {lang('FilterAddTo')}
        </Button>
      )}
      <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { byId: foldersById, orderedIds: folderOrderedIds } = global.chatFolders;

    return {
      foldersById,
      folderOrderedIds,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['editChatFolders']),
)(ChatFolderModal));
