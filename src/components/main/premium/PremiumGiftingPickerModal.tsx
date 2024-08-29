import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import { GIVEAWAY_MAX_ADDITIONAL_CHANNELS } from '../../../config';
import {
  filterUsersByName, isUserBot,
} from '../../../global/helpers';
import { unique } from '../../../util/iteratees';
import sortChatIds from '../../common/helpers/sortChatIds';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import PeerPicker from '../../common/pickers/PeerPicker';
import PickerModal from '../../common/pickers/PickerModal';

import styles from './PremiumGiftingPickerModal.module.scss';

export type OwnProps = {
  isOpen?: boolean;
};

interface StateProps {
  currentUserId?: string;
  userSelectionLimit?: number;
  userIds?: string[];
}

const PremiumGiftingPickerModal: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  userSelectionLimit = GIVEAWAY_MAX_ADDITIONAL_CHANNELS,
  userIds,
}) => {
  const { closePremiumGiftingModal, openPremiumGiftModal, showNotification } = getActions();

  const oldLang = useOldLang();

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const displayedUserIds = useMemo(() => {
    const usersById = getGlobal().users.byId;
    const filteredContactIds = userIds ? filterUsersByName(userIds, usersById, searchQuery) : [];

    return sortChatIds(unique(filteredContactIds).filter((userId) => {
      const user = usersById[userId];
      if (!user) {
        return true;
      }

      return !isUserBot(user) && userId !== currentUserId;
    }));
  }, [currentUserId, searchQuery, userIds]);

  const handleSendIdList = useLastCallback(() => {
    if (selectedUserIds?.length) {
      openPremiumGiftModal({ forUserIds: selectedUserIds });
      closePremiumGiftingModal();
    }
  });

  const handleSelectedUserIdsChange = useLastCallback((newSelectedIds: string[]) => {
    if (newSelectedIds.length > userSelectionLimit) {
      showNotification({
        message: oldLang('BoostingSelectUpToWarningUsers', userSelectionLimit),
      });
      return;
    }
    setSelectedUserIds(newSelectedIds);
  });

  return (
    <PickerModal
      className={styles.root}
      isOpen={isOpen}
      onClose={closePremiumGiftingModal}
      title={oldLang('GiftTelegramPremiumTitle')}
      hasCloseButton
      shouldAdaptToSearch
      withFixedHeight
      confirmButtonText={oldLang('Continue')}
      onConfirm={handleSendIdList}
      onEnter={handleSendIdList}
      withPremiumGradient
    >
      <PeerPicker
        className={styles.picker}
        itemIds={displayedUserIds}
        selectedIds={selectedUserIds}
        filterValue={searchQuery}
        filterPlaceholder={oldLang('Search')}
        onSelectedIdsChange={handleSelectedUserIdsChange}
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

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { currentUserId } = global;

  return {
    currentUserId,
    userIds: global.contactList?.userIds,
    userSelectionLimit: global.appConfig?.giveawayAddPeersMax,
  };
})(PremiumGiftingPickerModal));
