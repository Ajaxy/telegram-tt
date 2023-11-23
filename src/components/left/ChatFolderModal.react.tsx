/* eslint-disable react/self-closing-comp */
import React, {
  memo, useCallback, useMemo, useState,
} from 'react';
import type { FC } from '../../lib/teact/teact';
import { getActions, withGlobalReact as withGlobal } from '../../global';

import type { ApiChatFolder } from '../../api/types';

import { ALL_FOLDER_ID } from '../../config';

import useLang from '../../hooks/useLang.react';

import Button from '../ui/Button.react';
import CheckboxGroup from '../ui/CheckboxGroup.react';
import Modal from '../ui/Modal.react';

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

const ChatFolderModal: FC<OwnProps & StateProps> = ({
  isOpen,
  chatId,
  foldersById,
  folderOrderedIds,
  onClose,
  onCloseAnimationEnd,
}) => {
  const { editChatFolders } = getActions();

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
    return folderOrderedIds?.filter((folderId) => folderId !== ALL_FOLDER_ID).map((folderId) => ({
      label: foldersById ? foldersById[folderId].title : '',
      value: String(folderId),
    })) || [];
  }, [folderOrderedIds, foldersById]);

  const handleSubmit = useCallback(() => {
    const idsToRemove = initialSelectedFolderIds.filter((id) => !selectedFolderIds.includes(id)).map(Number);
    const idsToAdd = selectedFolderIds.filter((id) => !initialSelectedFolderIds.includes(id)).map(Number);

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
      <CheckboxGroup
        options={folders}
        selected={selectedFolderIds}
        onChange={setSelectedFolderIds}
        round
      />
      <div className="dialog-buttons">
        <Button color="primary" className="confirm-dialog-button" onClick={handleSubmit}>
          {lang('FilterAddTo')}
          <div className="hotkey-frame">
            <div className="hotkey-icon"></div>
          </div>
        </Button>
        <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
      </div>
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
)(ChatFolderModal));
