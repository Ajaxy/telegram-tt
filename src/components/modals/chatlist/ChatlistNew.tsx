import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiChatlistInviteNew } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';

import PeerPicker from '../../common/pickers/PeerPicker';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';

import styles from './ChatlistModal.module.scss';

type OwnProps = {
  invite: ApiChatlistInviteNew;
};

const ChatlistNew: FC<OwnProps> = ({ invite }) => {
  const { closeChatlistModal, joinChatlistInvite } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();
  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>(invite.peerIds);

  const joinedIds = useMemo(() => {
    const chatsById = getGlobal().chats.byId;
    return invite.peerIds.filter((id) => !chatsById[id].isNotJoined);
  }, [invite.peerIds]);

  const selectedCount = selectedPeerIds.length - joinedIds.length;

  const badgeText = selectedCount ? selectedCount.toString() : undefined;

  const handleButtonClick = useCallback(() => {
    closeChatlistModal();

    joinChatlistInvite({
      invite,
      peerIds: selectedPeerIds,
    });
  }, [invite, selectedPeerIds]);

  const handleSelectionToggle = useCallback(() => {
    const areAllSelected = selectedPeerIds.length === invite.peerIds.length;
    setSelectedPeerIds(areAllSelected ? joinedIds : invite.peerIds);
  }, [invite.peerIds, joinedIds, selectedPeerIds.length]);

  return (
    <div className={styles.content}>
      <div className={styles.description}>
        {lang('FolderLinkSubtitleNew')}
      </div>
      <div className={buildClassName(styles.pickerWrapper, 'custom-scroll')}>
        <div className={styles.pickerHeader}>
          <div className={styles.pickerHeaderInfo}>
            {oldLang('FolderLinkHeaderChatsJoin', selectedCount, 'i')}
          </div>
          <div
            className={styles.selectionToggle}
            role="button"
            tabIndex={0}
            onClick={handleSelectionToggle}
          >
            {selectedPeerIds.length === invite.peerIds.length ? oldLang('DeselectAll') : oldLang('SelectAll')}
          </div>
        </div>
        <PeerPicker
          itemIds={invite.peerIds}
          lockedSelectedIds={joinedIds}
          onSelectedIdsChange={setSelectedPeerIds}
          selectedIds={selectedPeerIds}
          allowMultiple
          withStatus
          itemInputType="checkbox"
        />
      </div>
      <Button
        onClick={handleButtonClick}
        size="smaller"
        disabled={!selectedPeerIds.length}
      >
        <div className={styles.buttonText}>
          {lang('FolderLinkAddFolder')}
          <Badge className={styles.buttonBadge} text={badgeText} isAlternateColor />
        </div>
      </Button>
    </div>
  );
};

export default memo(ChatlistNew);
