import React, {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import {
  isChatChannel, isChatPublic, isChatSuperGroup,
} from '../../../global/helpers';
import { filterPeersByQuery } from '../../../global/helpers/peers';
import { unique } from '../../../util/iteratees';
import sortChatIds from '../../common/helpers/sortChatIds';

import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import PeerPicker from '../../common/pickers/PeerPicker';
import PickerModal from '../../common/pickers/PickerModal';
import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  isOpen?: boolean;
  giveawayChatId?: string;
  selectionLimit: number;
  initialSelectedIds: string[];
  onSelectedIdsConfirmed: (newSelectedIds: string[]) => void;
  onClose: NoneToVoidFunction;
};

const GiveawayChannelPickerModal = ({
  isOpen,
  giveawayChatId,
  selectionLimit,
  initialSelectedIds,
  onSelectedIdsConfirmed,
  onClose,
}: OwnProps) => {
  const { showNotification } = getActions();
  const lang = useOldLang();

  const [pendingChannelId, setPendingChannelId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isConfirmModalOpen, openConfirmModal, closeConfirmModal] = useFlag();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  }, [initialSelectedIds]);

  const channelIds = useMemo(() => {
    const global = getGlobal();
    const chatsById = global.chats.byId;
    const { active, archived } = global.chats.listIds;
    const ids = (active || []).concat(archived || []);

    return unique(ids).map((id) => chatsById[id])
      .filter((chat) => (
        chat && (
          isChatChannel(chat) || isChatSuperGroup(chat)
        ) && chat.id !== giveawayChatId
      )).map((chat) => chat.id);
  }, [giveawayChatId]);

  const displayedChannelIds = useMemo(() => {
    const foundChannelIds = channelIds ? filterPeersByQuery({ ids: channelIds, query: searchQuery, type: 'chat' }) : [];

    return sortChatIds(foundChannelIds,
      false,
      selectedIds);
  }, [channelIds, searchQuery, selectedIds]);

  const handleSelectedChannelIdsChange = useLastCallback((newSelectedIds: string[]) => {
    const chatsById = getGlobal().chats.byId;
    const newlyAddedIds = newSelectedIds.filter((id) => !selectedIds.includes(id));
    const privateLinkChannelId = newlyAddedIds.find((id) => {
      const chat = chatsById[id];
      return chat && !isChatPublic(chat);
    });

    if (selectedIds?.length >= selectionLimit) {
      showNotification({
        message: lang('BoostingSelectUpToWarningChannelsPlural', selectionLimit),
      });
      return;
    }

    if (privateLinkChannelId) {
      setPendingChannelId(privateLinkChannelId);
      openConfirmModal();
    } else {
      setSelectedIds(newSelectedIds);
    }
  });

  const confirmPrivateLinkChannelSelection = useLastCallback(() => {
    if (pendingChannelId) {
      setSelectedIds(unique([...selectedIds, pendingChannelId]));
    }
    closeConfirmModal();
  });

  const handleModalConfirm = useLastCallback(() => {
    onSelectedIdsConfirmed(selectedIds);
    onClose();
  });

  return (
    <PickerModal
      isOpen={isOpen}
      onClose={onClose}
      title={lang('RequestPeer.ChooseChannelTitle')}
      hasCloseButton
      shouldAdaptToSearch
      withFixedHeight
      confirmButtonText={lang('Save')}
      onConfirm={handleModalConfirm}
      onEnter={handleModalConfirm}
    >
      <PeerPicker
        itemIds={displayedChannelIds}
        selectedIds={selectedIds}
        filterValue={searchQuery}
        filterPlaceholder={lang('Search')}
        onSelectedIdsChange={handleSelectedChannelIdsChange}
        onFilterChange={setSearchQuery}
        isSearchable
        withDefaultPadding
        withStatus
        allowMultiple
        itemInputType="checkbox"
      />
      <ConfirmDialog
        title={lang('BoostingGiveawayPrivateChannel')}
        text={lang('BoostingGiveawayPrivateChannelWarning')}
        confirmLabel={lang('Add')}
        isOpen={isConfirmModalOpen}
        onClose={closeConfirmModal}
        confirmHandler={confirmPrivateLinkChannelSelection}
      />
    </PickerModal>
  );
};

export default memo(GiveawayChannelPickerModal);
