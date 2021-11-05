import React, {
  FC, useCallback, useEffect, useMemo, memo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiChat, ApiUser } from '../../../api/types';

import { pick, unique } from '../../../util/iteratees';
import { throttle } from '../../../util/schedulers';
import searchWords from '../../../util/searchWords';
import { getUserFullName, isUserBot, sortChatIds } from '../../../modules/helpers';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import Picker from '../../common/Picker';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Button from '../../ui/Button';

export type OwnProps = {
  isChannel?: boolean;
  isActive: boolean;
  selectedMemberIds: string[];
  onSelectedMemberIdsChange: (ids: string[]) => void;
  onNextStep: () => void;
  onReset: () => void;
};

type StateProps = {
  currentUserId?: string;
  usersById: Record<string, ApiUser>;
  chatsById: Record<string, ApiChat>;
  localContactIds?: string[];
  searchQuery?: string;
  isSearching?: boolean;
  localUserIds?: string[];
  globalUserIds?: string[];
};

type DispatchProps = Pick<GlobalActions, 'loadContactList' | 'setGlobalSearchQuery'>;

const runThrottled = throttle((cb) => cb(), 60000, true);

const NewChatStep1: FC<OwnProps & StateProps & DispatchProps> = ({
  isChannel,
  isActive,
  selectedMemberIds,
  onSelectedMemberIdsChange,
  onNextStep,
  onReset,
  currentUserId,
  usersById,
  chatsById,
  localContactIds,
  searchQuery,
  isSearching,
  localUserIds,
  globalUserIds,
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

  const lang = useLang();

  useHistoryBack(isActive, onReset);

  const handleFilterChange = useCallback((query: string) => {
    setGlobalSearchQuery({ query });
  }, [setGlobalSearchQuery]);

  const displayedIds = useMemo(() => {
    const contactIds = localContactIds
      ? sortChatIds(localContactIds.filter((id) => id !== currentUserId), chatsById)
      : [];

    if (!searchQuery) {
      return contactIds;
    }

    const foundContactIds = contactIds.filter((id) => {
      const user = usersById[id];
      if (!user) {
        return false;
      }
      const fullName = getUserFullName(user);
      return fullName && searchWords(fullName, searchQuery);
    });

    return sortChatIds(
      unique([
        ...foundContactIds,
        ...(localUserIds || []),
        ...(globalUserIds || []),
      ]).filter((contactId) => {
        const user = usersById[contactId];

        return !user || !isUserBot(user) || user.canBeInvitedToGroup;
      }),
      chatsById,
      false,
      selectedMemberIds,
    );
  }, [
    localContactIds, chatsById, searchQuery, localUserIds, globalUserIds, selectedMemberIds,
    currentUserId, usersById,
  ]);

  const handleNextStep = useCallback(() => {
    if (selectedMemberIds.length || isChannel) {
      setGlobalSearchQuery({ query: '' });
      onNextStep();
    }
  }, [selectedMemberIds.length, isChannel, setGlobalSearchQuery, onNextStep]);

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
          isShown={Boolean(selectedMemberIds.length || isChannel)}
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
    const { byId: chatsById } = global.chats;
    const { currentUserId } = global;

    const {
      query: searchQuery,
      fetchingStatus,
      globalResults,
      localResults,
    } = global.globalSearch;
    const { userIds: globalUserIds } = globalResults || {};
    const { userIds: localUserIds } = localResults || {};

    return {
      currentUserId,
      usersById,
      chatsById,
      localContactIds,
      searchQuery,
      isSearching: fetchingStatus?.chats,
      globalUserIds,
      localUserIds,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadContactList', 'setGlobalSearchQuery']),
)(NewChatStep1));
