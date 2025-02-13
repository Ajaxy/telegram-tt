import React, { memo, useMemo, useState } from '../../../lib/teact/teact';

import { filterPeersByQuery } from '../../../global/helpers/peers';
import { unique } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';

import useOldLang from '../../../hooks/useOldLang';

import PeerPicker from '../../common/pickers/PeerPicker';

interface OwnProps {
  id: string;
  contactListIds?: string[];
  currentUserId: string;
  selectedIds?: string[];
  lockedIds?: string[];
  onSelect: (selectedIds: string[]) => void;
}

function AllowDenyList({
  id,
  contactListIds,
  currentUserId,
  selectedIds,
  lockedIds,
  onSelect,
}: OwnProps) {
  const lang = useOldLang();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const displayedIds = useMemo(() => {
    const contactIds = (contactListIds || []).filter((userId) => userId !== currentUserId);
    return unique(filterPeersByQuery({ ids: [...selectedIds || [], ...contactIds], query: searchQuery, type: 'user' }));
  }, [contactListIds, currentUserId, searchQuery, selectedIds]);

  return (
    <PeerPicker
      key={id}
      itemIds={displayedIds}
      selectedIds={selectedIds ?? MEMO_EMPTY_ARRAY}
      lockedSelectedIds={lockedIds}
      filterValue={searchQuery}
      filterPlaceholder={lang('Search')}
      searchInputId={`${id}-picker-search`}
      isSearchable
      withDefaultPadding
      forceShowSelf
      onSelectedIdsChange={onSelect}
      onFilterChange={setSearchQuery}
      allowMultiple
      withStatus
      itemInputType="checkbox"
    />
  );
}

export default memo(AllowDenyList);
