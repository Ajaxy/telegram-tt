import { memo, useCallback, useEffect, useMemo, useState } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import { isUserBot } from '../../../../global/helpers';
import { filterPeersByQuery } from '../../../../global/helpers/peers';
import { selectTabState } from '../../../../global/selectors';
import { unique } from '../../../../util/iteratees';
import sortChatIds from '../../../../components/common/helpers/sortChatIds';

import useHistoryBack from '../../../../hooks/useHistoryBack';
import useOldLang from '../../../../hooks/useOldLang';

import PeerPicker from '../../../../components/common/pickers/PeerPicker';
import FloatingActionButton from '../../../../components/ui/FloatingActionButton';

export type OwnProps = {
  isActive: boolean;
  selectedMemberIds: string[];
  lockedMemberIds?: string[];
  onSelectedMemberIdsChange: (ids: string[]) => void;
  onNextStep: () => void;
  onReset: () => void;
};

type StateProps = {
  localContactIds?: string[];
  searchQuery?: string;
  isSearching?: boolean;
  localPeerIds?: string[];
  globalPeerIds?: string[];
};

const TelebizOrganizationsAddMembers = ({
  isActive,
  selectedMemberIds,
  lockedMemberIds,
  localContactIds,
  searchQuery,
  isSearching,
  localPeerIds,
  globalPeerIds,
  onSelectedMemberIdsChange,
  onNextStep,
  onReset,
}: OwnProps & StateProps) => {
  const {
    setGlobalSearchQuery,
  } = getActions();

  const [pendingSelectedMemberIds, setPendingSelectedMemberIds] = useState<string[]>(selectedMemberIds);

  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleFilterChange = useCallback((query: string) => {
    setGlobalSearchQuery({ query });
  }, []);

  useEffect(() => {
    setPendingSelectedMemberIds(selectedMemberIds);
  }, [selectedMemberIds]);

  const displayedIds = useMemo(() => {
    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    const foundContactIds = localContactIds
      ? filterPeersByQuery({ ids: localContactIds, query: searchQuery, type: 'user' }) : [];

    return sortChatIds(
      unique([
        ...foundContactIds,
        ...(localPeerIds || []),
        ...(globalPeerIds || []),
      ]).filter((contactId) => {
        const user = usersById[contactId];

        return user && !user.isSelf && (user.canBeInvitedToGroup || !isUserBot(user));
      }),
      false,
      selectedMemberIds,
    );
  }, [localContactIds, searchQuery, localPeerIds, globalPeerIds, selectedMemberIds]);

  const handleNextStep = useCallback(() => {
    onSelectedMemberIdsChange(pendingSelectedMemberIds);
    setGlobalSearchQuery({ query: '' });
    onNextStep();
  }, [onNextStep, onSelectedMemberIdsChange, pendingSelectedMemberIds]);

  return (
    <div className="settings-fab-wrapper">
      <PeerPicker
        itemIds={displayedIds}
        selectedIds={pendingSelectedMemberIds}
        filterValue={searchQuery}
        filterPlaceholder={lang('SendMessageTo')}
        searchInputId="new-group-picker-search"
        isLoading={isSearching}
        isSearchable
        allowMultiple
        withStatus
        itemInputType="checkbox"
        withDefaultPadding
        onSelectedIdsChange={setPendingSelectedMemberIds}
        onFilterChange={handleFilterChange}
        lockedSelectedIds={lockedMemberIds}
        forceShowSelf
      />

      <FloatingActionButton
        isShown
        onClick={handleNextStep}
        ariaLabel="Save Members"
        iconName="check"
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { userIds: localContactIds } = global.contactList || {};

    const {
      query: searchQuery,
      fetchingStatus,
      globalResults,
      localResults,
    } = selectTabState(global).globalSearch;
    const { peerIds: globalPeerIds } = globalResults || {};
    const { peerIds: localPeerIds } = localResults || {};

    return {
      localContactIds,
      searchQuery,
      isSearching: fetchingStatus?.chats,
      globalPeerIds,
      localPeerIds,
    };
  },
)(TelebizOrganizationsAddMembers));
