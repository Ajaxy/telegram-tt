import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiUser } from '../../../api/types';

import { filterUsersByName } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { unique } from '../../../util/iteratees';

import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Picker from '../../common/Picker';
import FloatingActionButton from '../../ui/FloatingActionButton';

import styles from './CloseFriends.module.scss';

export type OwnProps = {
  isActive?: boolean;
  currentUserId: string;
  usersById: Record<string, ApiUser>;
  contactListIds?: string[];
  onClose: NoneToVoidFunction;
};

function CloseFriends({
  isActive, contactListIds, usersById, currentUserId, onClose,
}: OwnProps) {
  const { saveCloseFriends } = getActions();

  const lang = useLang();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitShown, setIsSubmitShown] = useState<boolean>(false);
  const [newSelectedContactIds, setNewSelectedContactIds] = useState<string[]>([]);

  const closeFriendIds = useMemo(() => {
    return (contactListIds || []).filter((userId) => usersById[userId]?.isCloseFriend);
  }, [contactListIds, usersById]);

  const displayedIds = useMemo(() => {
    const contactIds = (contactListIds || []).filter((id) => id !== currentUserId);
    return unique(filterUsersByName([...closeFriendIds, ...contactIds], usersById, searchQuery));
  }, [closeFriendIds, contactListIds, currentUserId, searchQuery, usersById]);

  useEffectWithPrevDeps(([prevIsActive]) => {
    if (!prevIsActive && isActive) {
      setIsSubmitShown(false);
      setNewSelectedContactIds(closeFriendIds);
    }
  }, [isActive, closeFriendIds]);

  const handleSelectedContactIdsChange = useCallback((value: string[]) => {
    setNewSelectedContactIds(value);
    setIsSubmitShown(true);
  }, []);

  const handleSubmit = useLastCallback(() => {
    saveCloseFriends({ userIds: newSelectedContactIds });
    onClose();
  });

  return (
    <>
      <Picker
        itemIds={displayedIds || []}
        selectedIds={newSelectedContactIds}
        filterValue={searchQuery}
        filterPlaceholder={lang('Search')}
        searchInputId="close-friends-picker-search"
        isSearchable
        onSelectedIdsChange={handleSelectedContactIdsChange}
        onFilterChange={setSearchQuery}
      />

      <div className={buildClassName(styles.buttonHolder, isSubmitShown && styles.active)}>
        <FloatingActionButton
          isShown={isSubmitShown}
          onClick={handleSubmit}
          ariaLabel={lang('Save')}
        >
          <i className="icon icon-check" />
        </FloatingActionButton>
      </div>
    </>
  );
}

export default memo(CloseFriends);
