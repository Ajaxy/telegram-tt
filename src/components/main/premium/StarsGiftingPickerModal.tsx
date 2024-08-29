import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useMemo,
  useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import {
  filterUsersByName, isDeletedUser, isUserBot,
} from '../../../global/helpers';
import { unique } from '../../../util/iteratees';
import sortChatIds from '../../common/helpers/sortChatIds';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import PeerPicker from '../../common/pickers/PeerPicker';
import PickerModal from '../../common/pickers/PickerModal';

import styles from './StarsGiftingPickerModal.module.scss';

export type OwnProps = {
  isOpen?: boolean;
};

interface StateProps {
  currentUserId?: string;
  userIds?: string[];
  activeListIds?: string[];
  archivedListIds?: string[];
}

const StarsGiftingPickerModal: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  activeListIds,
  archivedListIds,
  userIds,
}) => {
  const { closeStarsGiftingModal, openStarsGiftModal } = getActions();

  const oldLang = useOldLang();

  const [searchQuery, setSearchQuery] = useState<string>('');

  const displayedUserIds = useMemo(() => {
    const usersById = getGlobal().users.byId;
    const combinedIds = [
      ...(userIds || []),
      ...(activeListIds || []),
      ...(archivedListIds || []),
    ];

    const filteredContactIds = filterUsersByName(combinedIds, usersById, searchQuery);

    return sortChatIds(unique(filteredContactIds).filter((id) => {
      const user = usersById[id];

      if (!user) {
        return false;
      }

      return !user.isSupport
        && !isUserBot(user) && !isDeletedUser(user)
        && id !== currentUserId && id !== SERVICE_NOTIFICATIONS_USER_ID;
    }));
  }, [currentUserId, searchQuery, userIds, activeListIds, archivedListIds]);

  const handleSelectedUserIdsChange = useLastCallback((newSelectedId?: string) => {
    if (newSelectedId?.length) {
      openStarsGiftModal({ forUserId: newSelectedId });
    }
  });

  return (
    <PickerModal
      className={styles.root}
      isOpen={isOpen}
      onClose={closeStarsGiftingModal}
      title={oldLang('GiftStarsTitle')}
      hasCloseButton
      shouldAdaptToSearch
      withFixedHeight
      confirmButtonText={oldLang('Continue')}
      onEnter={closeStarsGiftingModal}
    >
      <PeerPicker
        className={styles.picker}
        itemIds={displayedUserIds}
        filterValue={searchQuery}
        filterPlaceholder={oldLang('Search')}
        onFilterChange={setSearchQuery}
        isSearchable
        withDefaultPadding
        withStatus
        onSelectedIdChange={handleSelectedUserIdsChange}
      />
    </PickerModal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    chats: {
      listIds,
    },
    currentUserId,
  } = global;

  return {
    userIds: global.contactList?.userIds,
    activeListIds: listIds.active,
    archivedListIds: listIds.archived,
    currentUserId,
  };
})(StarsGiftingPickerModal));
