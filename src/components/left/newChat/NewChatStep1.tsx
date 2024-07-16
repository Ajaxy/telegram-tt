import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import { filterUsersByName, isUserBot } from '../../../global/helpers';
import { selectTabState } from '../../../global/selectors';
import { unique } from '../../../util/iteratees';
import sortChatIds from '../../common/helpers/sortChatIds';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import Picker from '../../common/Picker';
import Button from '../../ui/Button';
import FloatingActionButton from '../../ui/FloatingActionButton';

export type OwnProps = {
  isChannel?: boolean;
  isActive: boolean;
  selectedMemberIds: string[];
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

const NewChatStep1: FC<OwnProps & StateProps> = ({
  isChannel,
  isActive,
  selectedMemberIds,
  localContactIds,
  searchQuery,
  isSearching,
  localPeerIds,
  globalPeerIds,
  onSelectedMemberIdsChange,
  onNextStep,
  onReset,
}) => {
  const {
    setGlobalSearchQuery,
  } = getActions();

  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleFilterChange = useCallback((query: string) => {
    setGlobalSearchQuery({ query });
  }, []);

  const displayedIds = useMemo(() => {
    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    const foundContactIds = localContactIds ? filterUsersByName(localContactIds, usersById, searchQuery) : [];

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
    setGlobalSearchQuery({ query: '' });
    onNextStep();
  }, [onNextStep]);

  return (
    <div className="NewChat step-1">
      <div className="left-header">
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={onReset}
          ariaLabel="Return to Chat List"
        >
          <i className="icon icon-arrow-left" />
        </Button>
        <h3>{lang('GroupAddMembers')}</h3>
      </div>
      <div className="NewChat-inner step-1">
        <Picker
          itemIds={displayedIds}
          selectedIds={selectedMemberIds}
          filterValue={searchQuery}
          filterPlaceholder={lang('SendMessageTo')}
          searchInputId="new-group-picker-search"
          isLoading={isSearching}
          isSearchable
          onSelectedIdsChange={onSelectedMemberIdsChange}
          onFilterChange={handleFilterChange}
        />

        <FloatingActionButton
          isShown
          onClick={handleNextStep}
          ariaLabel={isChannel ? 'Continue To Channel Info' : 'Continue To Group Info'}
        >
          <i className="icon icon-arrow-right" />
        </FloatingActionButton>
      </div>
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
)(NewChatStep1));
