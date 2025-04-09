import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiChatFolder } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import renderText from '../../common/helpers/renderText';

import useOldLang from '../../../hooks/useOldLang';

import PeerPicker from '../../common/pickers/PeerPicker';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';

import styles from './ChatlistModal.module.scss';

type OwnProps = {
  folder: ApiChatFolder;
  suggestedPeerIds?: string[];
};

const ChatlistDelete: FC<OwnProps> = ({
  folder,
  suggestedPeerIds = MEMO_EMPTY_ARRAY,
}) => {
  const { closeChatlistModal, leaveChatlist } = getActions();

  const lang = useOldLang();

  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>([]);

  const badgeText = selectedPeerIds.length ? selectedPeerIds.length.toString() : undefined;

  const handleSelectionToggle = useCallback(() => {
    const areAllSelected = selectedPeerIds.length === suggestedPeerIds.length;
    setSelectedPeerIds(areAllSelected ? [] : suggestedPeerIds);
  }, [suggestedPeerIds, selectedPeerIds.length]);

  const handleButtonClick = useCallback(() => {
    closeChatlistModal();
    leaveChatlist({ folderId: folder.id, peerIds: selectedPeerIds });
  }, [folder.id, selectedPeerIds]);

  return (
    <div className={styles.content}>
      {Boolean(suggestedPeerIds?.length) && (
        <>
          <div className={styles.description}>
            {renderText(lang('FolderLinkSubtitleRemove'), ['simple_markdown', 'emoji'])}
          </div>
          <div className={buildClassName(styles.pickerWrapper, 'custom-scroll')}>
            <div className={styles.pickerHeader}>
              <div className={styles.pickerHeaderInfo}>
                {lang('FolderLinkHeaderChatsQuit', selectedPeerIds.length, 'i')}
              </div>
              <div
                className={styles.selectionToggle}
                role="button"
                tabIndex={0}
                onClick={handleSelectionToggle}
              >
                {selectedPeerIds.length === suggestedPeerIds.length ? lang('DeselectAll') : lang('SelectAll')}
              </div>
            </div>
            <PeerPicker
              itemIds={suggestedPeerIds}
              onSelectedIdsChange={setSelectedPeerIds}
              selectedIds={selectedPeerIds}
              allowMultiple
              withStatus
              itemInputType="checkbox"
            />
          </div>
        </>
      )}
      <Button
        size="smaller"
        onClick={handleButtonClick}
      >
        <div className={styles.buttonText}>
          {!selectedPeerIds.length && lang('FolderLinkButtonRemove')}
          {Boolean(selectedPeerIds.length) && (
            <>
              {lang('FolderLinkButtonRemoveChats')}
              <Badge className={styles.buttonBadge} text={badgeText} isAlternateColor />
            </>
          )}
        </div>
      </Button>
    </div>
  );
};

export default memo(ChatlistDelete);
