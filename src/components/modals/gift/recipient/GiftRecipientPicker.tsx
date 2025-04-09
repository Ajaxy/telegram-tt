import React, {
  memo, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import { filterPeersByQuery } from '../../../../global/helpers/peers';
import { selectCanGift } from '../../../../global/selectors';
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
  userIds?: string[];
}

const GiftRecipientPicker = ({
  modal,
  currentUserId,
  userIds,
}: OwnProps & StateProps) => {
  const { closeGiftRecipientPicker, openGiftModal } = getActions();

  const oldLang = useOldLang();
  const isOpen = modal;

  const [searchQuery, setSearchQuery] = useState<string>('');

  const displayedUserIds = useMemo(() => {
    const global = getGlobal();
    const idsWithSelf = userIds ? userIds.concat(currentUserId!) : undefined;
    const filteredPeerIds = idsWithSelf ? filterPeersByQuery({ ids: idsWithSelf, query: searchQuery }) : [];

    return sortChatIds(unique(filteredPeerIds).filter((peerId) => {
      return selectCanGift(global, peerId);
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
  };
})(GiftRecipientPicker));
