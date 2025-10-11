import {
  memo, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type { TabState } from '../../../../global/types';
import type { UniqueCustomPeer } from '../../../../types';

import { ALL_FOLDER_ID } from '../../../../config';
import { selectCanGift } from '../../../../global/selectors';
import { unique } from '../../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import sortChatIds from '../../../common/helpers/sortChatIds';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import { useFolderManagerForOrderedIds } from '../../../../hooks/useFolderManager';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePeerSearch from '../../../../hooks/usePeerSearch';

import PeerPicker from '../../../common/pickers/PeerPicker';
import PickerModal from '../../../common/pickers/PickerModal';

export type OwnProps = {
  modal: TabState['giftTransferModal'];
};

type StateProps = {
  contactIds?: string[];
  currentUserId?: string;
};

type Categories = 'withdraw';

const GiftTransferModal = ({
  modal, contactIds, currentUserId,
}: OwnProps & StateProps) => {
  const {
    closeGiftTransferModal,
    openGiftWithdrawModal,
    openGiftTransferConfirmModal,
  } = getActions();
  const isOpen = Boolean(modal);

  const lang = useLang();

  const [searchQuery, setSearchQuery] = useState<string>('');

  const renderingModal = useCurrentOrPrev(modal);

  const orderedChatIds = useFolderManagerForOrderedIds(ALL_FOLDER_ID);

  const sortedLocalIds = useMemo(() => {
    return unique([
      ...(contactIds || []),
      ...(orderedChatIds || []),
    ]);
  }, [contactIds, orderedChatIds]);

  const { result: foundIds, currentResultsQuery } = usePeerSearch({
    query: searchQuery,
    defaultValue: sortedLocalIds,
  });

  const isLoading = currentResultsQuery !== searchQuery;

  const categories = useMemo(() => {
    if (currentResultsQuery) return MEMO_EMPTY_ARRAY;

    return [{
      type: 'withdraw',
      isCustomPeer: true,
      avatarIcon: 'toncoin',
      peerColorId: 5,
      title: lang('GiftTransferTON'),
    }] satisfies UniqueCustomPeer<Categories>[];
  }, [lang, currentResultsQuery]);

  const handleCategoryChange = useLastCallback((category: Categories) => {
    if (category !== 'withdraw') return;

    openGiftWithdrawModal({
      gift: renderingModal!.gift,
    });
    closeGiftTransferModal();
  });

  const displayIds = useMemo(() => {
    if (isLoading) return MEMO_EMPTY_ARRAY;
    const global = getGlobal();

    return sortChatIds((foundIds || []).filter((peerId) => (
      peerId !== currentUserId && selectCanGift(global, peerId)
    )),
    false);
  }, [isLoading, foundIds, currentUserId]);

  const handlePeerSelect = useLastCallback((peerId: string) => {
    if (!renderingModal?.gift) return;

    openGiftTransferConfirmModal({
      gift: renderingModal.gift,
      recipientId: peerId,
    });
  });

  return (
    <PickerModal
      isOpen={isOpen}
      onClose={closeGiftTransferModal}
      title={lang('GiftTransferTitle')}
      hasCloseButton
      shouldAdaptToSearch
      withFixedHeight
      ignoreFreeze
    >
      <PeerPicker<Categories>
        itemIds={displayIds}
        categories={categories}
        onSelectedCategoryChange={handleCategoryChange}
        withDefaultPadding
        withPeerUsernames
        isSearchable
        noScrollRestore
        isLoading={isLoading}
        filterValue={searchQuery}
        filterPlaceholder={lang('Search')}
        onFilterChange={setSearchQuery}
        onSelectedIdChange={handlePeerSelect}
      />
    </PickerModal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { contactList, currentUserId } = global;

    return {
      contactIds: contactList?.userIds,
      currentUserId,
    };
  },
)(GiftTransferModal));
