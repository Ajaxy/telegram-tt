import {
  memo, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import { filterPeersByQuery } from '../../../../global/helpers/peers';
import { selectCanGift } from '../../../../global/selectors';
import { unique } from '../../../../util/iteratees';
import sortChatIds from '../../../common/helpers/sortChatIds';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

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

  const lang = useLang();
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
      title={lang('GiftTelegramPremiumOrStarsTitle')}
      hasCloseButton
      withFixedHeight
    >
      <PeerPicker
        withIslands
        className={styles.picker}
        itemIds={displayedUserIds}
        filterValue={searchQuery}
        filterPlaceholder={lang('Search')}
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

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const { currentUserId } = global;

  return {
    currentUserId,
    userIds: global.contactList?.userIds,
  };
})(GiftRecipientPicker));
