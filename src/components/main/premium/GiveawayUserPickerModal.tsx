import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChatMember } from '../../../api/types';

import {
  isUserBot,
  sortUserIds,
} from '../../../global/helpers';
import { filterPeersByQuery } from '../../../global/helpers/peers';
import { selectChatFullInfo } from '../../../global/selectors';
import { unique } from '../../../util/iteratees';
import sortChatIds from '../../common/helpers/sortChatIds';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import PeerPicker from '../../common/pickers/PeerPicker';
import PickerModal from '../../common/pickers/PickerModal';

type OwnProps = {
  isOpen?: boolean;

  giveawayChatId?: string;
  selectionLimit: number;
  initialSelectedIds: string[];
  onSelectedIdsConfirmed: (newSelectedIds: string[]) => void;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  members?: ApiChatMember[];
  adminMembersById?: Record<string, ApiChatMember>;
};

const GiveawayUserPickerModal = ({
  isOpen,
  selectionLimit,
  members,
  adminMembersById,
  initialSelectedIds,
  onSelectedIdsConfirmed,
  onClose,
}: OwnProps & StateProps) => {
  const { showNotification } = getActions();
  const lang = useLang();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  }, [initialSelectedIds]);

  const memberIds = useMemo(() => {
    const global = getGlobal();
    const { byId, statusesById } = global.users;
    if (!members?.length) {
      return [];
    }

    const adminIdsSet = adminMembersById && new Set(Object.keys(adminMembersById));

    const userIds = sortUserIds(
      members.map(({ userId }) => userId),
      byId,
      statusesById,
    );

    return adminIdsSet ? userIds.filter((userId) => !adminIdsSet.has(userId)) : userIds;
  }, [adminMembersById, members]);

  const displayedMemberIds = useMemo(() => {
    const usersById = getGlobal().users.byId;
    const filteredUserIds = memberIds
      ? filterPeersByQuery({ ids: memberIds, query: searchQuery, type: 'user' }) : [];

    return sortChatIds(unique(filteredUserIds).filter((userId) => {
      const user = usersById[userId];
      if (!user) {
        return true;
      }

      return !isUserBot(user);
    }));
  }, [memberIds, searchQuery]);

  const handleSelectedMemberIdsChange = useLastCallback((newSelectedIds: string[]) => {
    if (newSelectedIds.length > selectionLimit) {
      showNotification({
        message: {
          key: 'GiveawayUserSelectionLimit',
          variables: { count: selectionLimit },
          options: {
            pluralValue: selectionLimit,
            withNodes: true,
            withMarkdown: true,
            renderTextFilters: ['br', 'links'],
          },
        },
      });
      return;
    }
    setSelectedIds(newSelectedIds);
  });

  const handleModalConfirm = useLastCallback(() => {
    onSelectedIdsConfirmed(selectedIds);
    onClose();
  });

  return (
    <PickerModal
      isOpen={isOpen}
      onClose={onClose}
      title={lang('BoostingAwardSpecificUsers')}
      hasCloseButton
      withFixedHeight
      confirmButtonText={lang('Save')}
      onConfirm={handleModalConfirm}
      onEnter={handleModalConfirm}
    >
      <PeerPicker
        withIslands
        itemIds={displayedMemberIds}
        selectedIds={selectedIds}
        filterValue={searchQuery}
        filterPlaceholder={lang('Search')}
        onSelectedIdsChange={handleSelectedMemberIdsChange}
        onFilterChange={setSearchQuery}
        isSearchable
        withDefaultPadding
        withStatus
        allowMultiple
        itemInputType="checkbox"
      />
    </PickerModal>
  );
};

export default memo(withGlobal<OwnProps>((global, { giveawayChatId }): Complete<StateProps> => {
  const chatFullInfo = giveawayChatId ? selectChatFullInfo(global, giveawayChatId) : undefined;
  if (!chatFullInfo) {
    return {
      members: undefined,
      adminMembersById: undefined,
    };
  }

  return {
    members: chatFullInfo.members,
    adminMembersById: chatFullInfo.adminMembersById,
  };
})(GiveawayUserPickerModal));
