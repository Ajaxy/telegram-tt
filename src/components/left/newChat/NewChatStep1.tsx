import React, {
  FC, useCallback, useEffect, useMemo, memo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiUser } from '../../../api/types';

import { pick, unique } from '../../../util/iteratees';
import { throttle } from '../../../util/schedulers';
import searchWords from '../../../util/searchWords';
import { getSortedUserIds, getUserFullName } from '../../../modules/helpers';
import useLang from '../../../hooks/useLang';

import Picker from '../../common/Picker';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Button from '../../ui/Button';

export type OwnProps = {
  isChannel?: boolean;
  selectedMemberIds: number[];
  onSelectedMemberIdsChange: (ids: number[]) => void;
  onNextStep: () => void;
  onReset: () => void;
};

type StateProps = {
  usersById: Record<number, ApiUser>;
  localContactIds?: number[];
  searchQuery?: string;
  isSearching?: boolean;
  localUsers?: ApiUser[];
  globalUsers?: ApiUser[];
};

type DispatchProps = Pick<GlobalActions, 'loadContactList' | 'setGlobalSearchQuery'>;

const runThrottled = throttle((cb) => cb(), 60000, true);

const NewChatStep1: FC<OwnProps & StateProps & DispatchProps> = ({
  isChannel,
  selectedMemberIds,
  onSelectedMemberIdsChange,
  onNextStep,
  onReset,
  usersById,
  localContactIds,
  searchQuery,
  isSearching,
  localUsers,
  globalUsers,
  loadContactList,
  setGlobalSearchQuery,
}) => {
  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadContactList();
    });
  });

  const handleFilterChange = useCallback((query: string) => {
    setGlobalSearchQuery({ query });
  }, [setGlobalSearchQuery]);

  const displayedIds = useMemo(() => {
    if (!searchQuery) {
      return localContactIds || [];
    }

    const foundLocalContacts = localContactIds ? localContactIds.filter((id) => {
      const user = usersById[id];
      if (!user) {
        return false;
      }
      const fullName = getUserFullName(user);
      return fullName && searchWords(fullName, searchQuery);
    }) : [];

    return getSortedUserIds(
      unique([
        ...foundLocalContacts,
        ...(localUsers ? localUsers.map((user) => user.id) : []),
        ...(globalUsers ? globalUsers.map((user) => user.id) : []),
      ]) as number[],
      usersById,
      selectedMemberIds,
    );
  }, [searchQuery, localContactIds, localUsers, globalUsers, usersById, selectedMemberIds]);

  const handleNextStep = useCallback(() => {
    if (selectedMemberIds.length) {
      setGlobalSearchQuery({ query: '' });
      onNextStep();
    }
  }, [selectedMemberIds, setGlobalSearchQuery, onNextStep]);

  const lang = useLang();

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
          <i className="icon-arrow-left" />
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
          onSelectedIdsChange={onSelectedMemberIdsChange}
          onFilterChange={handleFilterChange}
        />

        <FloatingActionButton
          isShown={Boolean(selectedMemberIds.length)}
          onClick={handleNextStep}
          ariaLabel={isChannel ? 'Continue To Channel Info' : 'Continue To Group Info'}
        >
          <i className="icon-arrow-right" />
        </FloatingActionButton>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { userIds: localContactIds } = global.contactList || {};
    const { byId: usersById } = global.users;

    const {
      query: searchQuery,
      fetchingStatus,
      globalResults,
      localResults,
    } = global.globalSearch;
    const { users: globalUsers } = globalResults || {};
    const { users: localUsers } = localResults || {};

    return {
      usersById,
      localContactIds,
      searchQuery,
      isSearching: fetchingStatus && fetchingStatus.chats,
      globalUsers,
      localUsers,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadContactList', 'setGlobalSearchQuery']),
)(NewChatStep1));
