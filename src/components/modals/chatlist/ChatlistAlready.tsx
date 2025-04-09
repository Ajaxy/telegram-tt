import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiChatFolder, ApiChatlistInviteAlready } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';

import PeerPicker from '../../common/pickers/PeerPicker';
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
  const oldLang = useOldLang();

  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>(invite.missingPeerIds);

  const hasChatsToAdd = Boolean(invite.missingPeerIds.length);
  const isNew = invite.alreadyPeerIds.length === 0;
  const newChatsCount = hasChatsToAdd ? invite.missingPeerIds.length : 0;
  const badgeText = selectedPeerIds.length ? selectedPeerIds.length.toString() : undefined;

  const descriptionText = isNew ? lang('FolderLinkSubtitleNew')
    : newChatsCount ? lang('FolderLinkSubtitleAdd', {
      chats: lang('FolderLinkSubtitleAddCount', { count: newChatsCount }, { pluralValue: newChatsCount }),
      title: renderTextWithEntities({
        text: folder.title.text,
        entities: folder.title.entities,
        noCustomEmojiPlayback: folder.noTitleAnimations,
      }),
    }, {
      withNodes: true,
      withMarkdown: true,
    }) : lang('FolderLinkSubtitleAlready');

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
                {oldLang('FolderLinkHeaderChatsJoin', selectedPeerIds.length, 'i')}
              </div>
              <div
                className={styles.selectionToggle}
                role="button"
                tabIndex={0}
                onClick={handleSelectionToggle}
              >
                {selectedPeerIds.length === invite.missingPeerIds.length
                  ? oldLang('DeselectAll') : oldLang('SelectAll')}
              </div>
            </div>
            <PeerPicker
              itemIds={invite.missingPeerIds}
              onSelectedIdsChange={setSelectedPeerIds}
              selectedIds={selectedPeerIds}
              allowMultiple
              withStatus
              itemInputType="checkbox"
            />
          </>
        )}
        <div className={styles.pickerHeader}>
          <div className={styles.pickerHeaderInfo}>
            {oldLang('FolderLinkHeaderAlready')}
          </div>
        </div>
        <PeerPicker
          itemIds={invite.alreadyPeerIds}
          lockedSelectedIds={invite.alreadyPeerIds}
          selectedIds={invite.alreadyPeerIds}
          allowMultiple
          withStatus
          itemInputType="checkbox"
        />
      </div>
      <Button
        size="smaller"
        onClick={handleButtonClick}
      >
        <div className={styles.buttonText}>
          {!selectedPeerIds.length && oldLang('OK')}
          {Boolean(selectedPeerIds.length) && (
            <>
              {oldLang('FolderLinkButtonJoinPlural', selectedPeerIds.length, 'i')}
              <Badge className={styles.buttonBadge} text={badgeText} isAlternateColor />
            </>
          )}
        </div>
      </Button>
    </div>
  );
};

export default memo(ChatlistAlready);
