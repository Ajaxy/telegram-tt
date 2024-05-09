import React, { memo, useMemo, useState } from '../../../lib/teact/teact';

import type { ApiUser } from '../../../api/types';

import { filterUsersByName } from '../../../global/helpers';
import { unique } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';

import useLang from '../../../hooks/useLang';

import Picker from '../../common/Picker';

interface OwnProps {
  id: string;
  contactListIds?: string[];
  currentUserId: string;
  selectedIds?: string[];
  lockedIds?: string[];
  usersById: Record<string, ApiUser>;
  onSelect: (selectedIds: string[]) => void;
}

function AllowDenyList({
  id,
  contactListIds,
  currentUserId,
  usersById,
  selectedIds,
  lockedIds,
  onSelect,
}: OwnProps) {
  const lang = useLang();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const displayedIds = useMemo(() => {
    const contactIds = (contactListIds || []).filter((userId) => userId !== currentUserId);
    return unique(filterUsersByName([...selectedIds || [], ...contactIds], usersById, searchQuery));
  }, [contactListIds, currentUserId, searchQuery, selectedIds, usersById]);

  return (
    <Picker
      key={id}
      itemIds={displayedIds}
      selectedIds={selectedIds ?? MEMO_EMPTY_ARRAY}
      lockedSelectedIds={lockedIds}
      filterValue={searchQuery}
      filterPlaceholder={lang('Search')}
      searchInputId={`${id}-picker-search`}
      isSearchable
      forceShowSelf
      onSelectedIdsChange={onSelect}
      onFilterChange={setSearchQuery}
    />
  );
}

export default memo(AllowDenyList);
