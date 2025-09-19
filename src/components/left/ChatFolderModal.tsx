import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChatFolder } from '../../api/types';

import { ALL_FOLDER_ID } from '../../config';
import buildClassName from '../../util/buildClassName';
import { renderTextWithEntities } from '../common/helpers/renderTextWithEntities';

import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import CheckboxGroup from '../ui/CheckboxGroup';
import Modal from '../ui/Modal';

import styles from './ChatFolderModal.module.scss';

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

  const lang = useOldLang();

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
    return folderOrderedIds?.filter((folderId) => folderId !== ALL_FOLDER_ID)
      .map((folderId) => {
        const folder = foldersById ? foldersById[folderId] : undefined;
        const label = folder ? renderTextWithEntities({
          text: folder.title.text,
          entities: folder.title.entities,
          noCustomEmojiPlayback: folder.noTitleAnimations,
        }) : '';
        return {
          label,
          value: String(folderId),
        };
      }) || [];
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
      className={buildClassName(styles.root, 'delete')}
      contentClassName={styles.modalContent}
      title={lang('FilterAddTo')}
    >
      <div className={buildClassName(styles.main, 'custom-scroll')}>
        <CheckboxGroup
          options={folders}
          selected={selectedFolderIds}
          onChange={setSelectedFolderIds}
        />
      </div>
      <div className={styles.footer}>
        <div className="dialog-buttons">
          <Button color="primary" className="confirm-dialog-button" isText onClick={handleSubmit}>
            {lang('FilterAddTo')}
          </Button>
          <Button className="confirm-dialog-button" isText onClick={onClose}>{lang('Cancel')}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { byId: foldersById, orderedIds: folderOrderedIds } = global.chatFolders;

    return {
      foldersById,
      folderOrderedIds,
    };
  },
)(ChatFolderModal));
