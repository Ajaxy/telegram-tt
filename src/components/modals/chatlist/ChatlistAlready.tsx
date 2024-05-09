import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiChatFolder, ApiChatlistInviteAlready } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';

import Picker from '../../common/Picker';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';

import styles from './ChatlistModal.module.scss';

type OwnProps = {
  invite: ApiChatlistInviteAlready;
  folder: ApiChatFolder;
};

const ChatlistAlready: FC<OwnProps> = ({ invite, folder }) => {
  const { closeChatlistModal, joinChatlistInvite } = getActions();

  const lang = useLang();

  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>(invite.missingPeerIds);

  const hasChatsToAdd = Boolean(invite.missingPeerIds.length);
  const newChatsCount = hasChatsToAdd ? invite.missingPeerIds.length : 0;
  const badgeText = selectedPeerIds.length ? selectedPeerIds.length.toString() : undefined;

  const descriptionText = hasChatsToAdd
    ? lang('FolderLinkSubtitleChats', [newChatsCount, folder.title], undefined, newChatsCount)
    : lang('FolderLinkSubtitleAlready', folder.title);

  const handleButtonClick = useCallback(() => {
    closeChatlistModal();

    if (!selectedPeerIds.length) return;

    joinChatlistInvite({
      invite,
      peerIds: selectedPeerIds,
    });
  }, [invite, selectedPeerIds]);

  const handleSelectionToggle = useCallback(() => {
    const areAllSelected = selectedPeerIds.length === invite.missingPeerIds.length;
    setSelectedPeerIds(areAllSelected ? [] : invite.missingPeerIds);
  }, [invite.missingPeerIds, selectedPeerIds.length]);

  return (
    <div className={styles.content}>
      <div className={styles.description}>
        {renderText(descriptionText, ['simple_markdown', 'emoji'])}
      </div>
      <div className={buildClassName(styles.pickerWrapper, 'custom-scroll')}>
        {Boolean(invite.missingPeerIds.length) && (
          <>
            <div className={styles.pickerHeader}>
              <div className={styles.pickerHeaderInfo}>
                {lang('FolderLinkHeaderChatsJoin', selectedPeerIds.length, 'i')}
              </div>
              <div
                className={styles.selectionToggle}
                role="button"
                tabIndex={0}
                onClick={handleSelectionToggle}
              >
                {selectedPeerIds.length === invite.missingPeerIds.length ? lang('DeselectAll') : lang('SelectAll')}
              </div>
            </div>
            <Picker
              itemIds={invite.missingPeerIds}
              onSelectedIdsChange={setSelectedPeerIds}
              selectedIds={selectedPeerIds}
            />
          </>
        )}
        <div className={styles.pickerHeader}>
          <div className={styles.pickerHeaderInfo}>
            {lang('FolderLinkHeaderAlready')}
          </div>
        </div>
        <Picker
          itemIds={invite.alreadyPeerIds}
          lockedSelectedIds={invite.alreadyPeerIds}
          selectedIds={invite.alreadyPeerIds}
        />
      </div>
      <Button
        size="smaller"
        onClick={handleButtonClick}
      >
        <div className={styles.buttonText}>
          {!selectedPeerIds.length && lang('OK')}
          {Boolean(selectedPeerIds.length) && (
            <>
              {lang('FolderLinkButtonJoinPlural', selectedPeerIds.length, 'i')}
              <Badge className={styles.buttonBadge} text={badgeText} isAlternateColor />
            </>
          )}
        </div>
      </Button>
    </div>
  );
};

export default memo(ChatlistAlready);
