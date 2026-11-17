import {
  memo, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type { TabState } from '../../../../global/types';
import type { UniqueCustomPeer } from '../../../../types';

import { ALL_FOLDER_ID } from '../../../../config';
import { selectCanGift, selectIsWalletAvailable } from '../../../../global/selectors';
import { getDays } from '../../../../util/dates/units';
import { unique } from '../../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { getServerTime } from '../../../../util/serverTime';
import sortChatIds from '../../../common/helpers/sortChatIds';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useFlag from '../../../../hooks/useFlag';
import { useFolderManagerForOrderedIds } from '../../../../hooks/useFolderManager';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePeerSearch from '../../../../hooks/usePeerSearch';

import PeerPicker from '../../../common/pickers/PeerPicker';
import PickerModal from '../../../common/pickers/PickerModal';
import ConfirmDialog from '../../../ui/ConfirmDialog';

export type OwnProps = {
  modal: TabState['giftTransferModal'];
};

type StateProps = {
  contactIds?: string[];
  currentUserId?: string;
  isWalletAvailable?: boolean;
};

type Categories = 'withdraw' | 'moveToWallet';

const GiftTransferModal = ({
  modal, contactIds, currentUserId, isWalletAvailable,
}: OwnProps & StateProps) => {
  const {
    closeGiftTransferModal,
    openGiftWithdrawModal,
    openGiftMoveToWalletModal,
    openGiftTransferConfirmModal,
  } = getActions();
  const isOpen = Boolean(modal);

  const lang = useLang();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUnlockInfoOpen, openUnlockInfo, closeUnlockInfo] = useFlag();

  const renderingModal = useCurrentOrPrev(modal);

  const orderedChatIds = useFolderManagerForOrderedIds(ALL_FOLDER_ID);

  const sortedLocalIds = useMemo(() => {
    return unique([
      ...(contactIds || []),
      ...(orderedChatIds || []),
    ]);
  }, [contactIds, orderedChatIds]);

  const { result: foundIds, currentResultsQuery, isSearching } = usePeerSearch({
    query: searchQuery,
    defaultValue: sortedLocalIds,
  });
  const relevantFoundIds = currentResultsQuery === searchQuery ? foundIds : undefined;

  const canExportAt = renderingModal?.gift.canExportAt;
  const exportDelay = canExportAt ? Math.max(canExportAt - getServerTime(), 0) : 0;
  const exportDays = getDays(exportDelay);

  const categories = useMemo(() => {
    if (searchQuery) return MEMO_EMPTY_ARRAY;

    if (isWalletAvailable) {
      return [{
        type: 'moveToWallet',
        isCustomPeer: true,
        avatarIcon: 'move-to-wallet',
        peerColorId: 5,
        title: lang('GiftMoveToWallet'),
      }] satisfies UniqueCustomPeer<Categories>[];
    }

    return [{
      type: 'withdraw',
      isCustomPeer: true,
      avatarIcon: 'toncoin',
      peerColorId: 5,
      title: lang('GiftTransferTON'),
    }] satisfies UniqueCustomPeer<Categories>[];
  }, [lang, searchQuery, isWalletAvailable]);

  const handleCategoryChange = useLastCallback((category: Categories) => {
    const { gift } = renderingModal!;

    if (category === 'withdraw') {
      openGiftWithdrawModal({ gift });
      closeGiftTransferModal();
      return;
    }

    if (exportDelay) {
      openUnlockInfo();
      return;
    }

    openGiftMoveToWalletModal({ gift });
    closeGiftTransferModal();
  });

  const displayIds = useMemo(() => {
    if (isSearching) return MEMO_EMPTY_ARRAY;
    const global = getGlobal();

    return sortChatIds((relevantFoundIds || []).filter((peerId) => (
      peerId !== currentUserId && selectCanGift(global, peerId)
    )),
    false);
  }, [isSearching, relevantFoundIds, currentUserId]);

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
      withFixedHeight
    >
      <PeerPicker<Categories>
        withIslands
        itemIds={displayIds}
        categories={categories}
        onSelectedCategoryChange={handleCategoryChange}
        withDefaultPadding
        withPeerUsernames
        isSearchable
        noScrollRestore
        isLoading={isSearching}
        filterValue={searchQuery}
        filterPlaceholder={lang('Search')}
        onFilterChange={setSearchQuery}
        onSelectedIdChange={handlePeerSelect}
      />
      <ConfirmDialog
        isOpen={isUnlockInfoOpen}
        title={lang('GiftTransferUnlocksTitle')}
        confirmLabel={lang('OK')}
        text={lang('GiftWithdrawWait', { days: exportDays }, { pluralValue: exportDays })}
        isOnlyConfirm
        confirmHandler={closeUnlockInfo}
        onClose={closeUnlockInfo}
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
      isWalletAvailable: selectIsWalletAvailable(global),
    };
  },
)(GiftTransferModal));
