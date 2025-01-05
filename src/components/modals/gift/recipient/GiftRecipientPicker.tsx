import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import {
  filterUsersByName, isUserBot,
} from '../../../../global/helpers';
import { unique } from '../../../../util/iteratees';
import sortChatIds from '../../../common/helpers/sortChatIds';

import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import PeerPicker from '../../../common/pickers/PeerPicker';
import PickerModal from '../../../common/pickers/PickerModal';

import styles from './GiftRecipientPicker.module.scss';

export type OwnProps = {
  modal?: boolean;
};

interface StateProps {
  currentUserId?: string;
  userSelectionLimit?: number;
  userIds?: string[];
}

const GiftRecipientPicker: FC<OwnProps & StateProps> = ({
  modal,
  currentUserId,
  userIds,
}) => {
  const { closeGiftRecipientPicker, openGiftModal } = getActions();

  const oldLang = useOldLang();
  const isOpen = modal;

  const [searchQuery, setSearchQuery] = useState<string>('');

  const displayedUserIds = useMemo(() => {
    const usersById = getGlobal().users.byId;
    const idsWithSelf = userIds ? userIds.concat(currentUserId!) : undefined;
    const filteredContactIds = idsWithSelf ? filterUsersByName(idsWithSelf, usersById, searchQuery) : [];

    return sortChatIds(unique(filteredContactIds).filter((userId) => {
      const user = usersById[userId];
      if (!user) {
        return true;
      }

      return !isUserBot(user);
    }), undefined, [currentUserId!]);
  }, [currentUserId, searchQuery, userIds]);

  const handleSelectedUserIdsChange = useLastCallback((selectedId: string) => {
    openGiftModal({ forUserId: selectedId });
    closeGiftRecipientPicker();
  });

  return (
    <PickerModal
      className={styles.root}
      isOpen={isOpen}
      onClose={closeGiftRecipientPicker}
      title={oldLang('GiftTelegramPremiumOrStarsTitle')}
      hasCloseButton
      shouldAdaptToSearch
      withFixedHeight
    >
      <PeerPicker
        className={styles.picker}
        itemIds={displayedUserIds}
        filterValue={searchQuery}
        filterPlaceholder={oldLang('Search')}
        onSelectedIdChange={handleSelectedUserIdsChange}
        onFilterChange={setSearchQuery}
        isSearchable
        withDefaultPadding
        withStatus
        forceShowSelf
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
})(GiftRecipientPicker));
