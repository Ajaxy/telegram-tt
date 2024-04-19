import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiChatlistInviteNew } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';

import Picker from '../../common/Picker';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';

import styles from './ChatlistModal.module.scss';

type OwnProps = {
  invite: ApiChatlistInviteNew;
};

const ChatlistNew: FC<OwnProps> = ({ invite }) => {
  const { closeChatlistModal, joinChatlistInvite } = getActions();

  const lang = useLang();
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
        {renderText(lang('FolderLinkSubtitle', invite.title), ['simple_markdown', 'emoji'])}
      </div>
      <div className={buildClassName(styles.pickerWrapper, 'custom-scroll')}>
        <div className={styles.pickerHeader}>
          <div className={styles.pickerHeaderInfo}>
            {lang('FolderLinkHeaderChatsJoin', selectedCount, 'i')}
          </div>
          <div
            className={styles.selectionToggle}
            role="button"
            tabIndex={0}
            onClick={handleSelectionToggle}
          >
            {selectedPeerIds.length === invite.peerIds.length ? lang('DeselectAll') : lang('SelectAll')}
          </div>
        </div>
        <Picker
          itemIds={invite.peerIds}
          lockedSelectedIds={joinedIds}
          onSelectedIdsChange={setSelectedPeerIds}
          selectedIds={selectedPeerIds}
        />
      </div>
      <Button
        onClick={handleButtonClick}
        size="smaller"
        disabled={!selectedPeerIds.length}
      >
        <div className={styles.buttonText}>
          {lang('FolderLinkButtonAdd', invite.title)}
          <Badge className={styles.buttonBadge} text={badgeText} isAlternateColor />
        </div>
      </Button>
    </div>
  );
};

export default memo(ChatlistNew);
