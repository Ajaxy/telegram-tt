import React, {
  memo, useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type { ApiStarGiftUnique } from '../../../../api/types';
import type { TabState } from '../../../../global/types';
import type { UniqueCustomPeer } from '../../../../types';

import { ALL_FOLDER_ID } from '../../../../config';
import { getPeerTitle } from '../../../../global/helpers';
import { selectCanGift, selectPeer } from '../../../../global/selectors';
import { unique } from '../../../../util/iteratees';
import { formatStarsAsIcon, formatStarsAsText } from '../../../../util/localization/format';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { getGiftAttributes } from '../../../common/helpers/gifts';
import { REM } from '../../../common/helpers/mediaDimensions';
import sortChatIds from '../../../common/helpers/sortChatIds';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import { useFolderManagerForOrderedIds } from '../../../../hooks/useFolderManager';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePeerSearch from '../../../../hooks/usePeerSearch';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import Avatar from '../../../common/Avatar';
import Icon from '../../../common/icons/Icon';
import PeerPicker from '../../../common/pickers/PeerPicker';
import PickerModal from '../../../common/pickers/PickerModal';
import RadialPatternBackground from '../../../common/profile/RadialPatternBackground';
import ConfirmDialog from '../../../ui/ConfirmDialog';

import styles from './GiftTransferModal.module.scss';

export type OwnProps = {
  modal: TabState['giftTransferModal'];
};

type StateProps = {
  contactIds?: string[];
  currentUserId?: string;
};

type Categories = 'withdraw';

const AVATAR_SIZE = 4 * REM;
const GIFT_STICKER_SIZE = 3 * REM;

const GiftTransferModal = ({
  modal, contactIds, currentUserId,
}: OwnProps & StateProps) => {
  const { closeGiftTransferModal, openGiftWithdrawModal, transferGift } = getActions();
  const isOpen = Boolean(modal);

  const lang = useLang();

  const [searchQuery, setSearchQuery] = useState<string>('');

  const renderingModal = useCurrentOrPrev(modal);
  const uniqueGift = renderingModal?.gift?.gift as ApiStarGiftUnique;
  const giftAttributes = uniqueGift && getGiftAttributes(uniqueGift);

  const [selectedId, setSelectedId] = useState<string | undefined>();

  const renderingSelectedPeerId = useCurrentOrPrev(selectedId);
  const renderingSelectedPeer = useMemo(() => {
    const global = getGlobal();
    return renderingSelectedPeerId ? selectPeer(global, renderingSelectedPeerId) : undefined;
  }, [renderingSelectedPeerId]);

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

  const closeConfirmModal = useLastCallback(() => {
    setSelectedId(undefined);
  });

  useEffect(() => {
    if (!isOpen) {
      setSelectedId(undefined);
    }
  }, [isOpen]);

  const handleTransfer = useLastCallback(() => {
    if (!renderingModal?.gift.inputGift) return;
    transferGift({
      gift: renderingModal.gift.inputGift,
      recipientId: renderingSelectedPeerId!,
      transferStars: renderingModal.gift.transferStars,
    });

    closeConfirmModal();
    closeGiftTransferModal();
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
        onSelectedIdChange={setSelectedId}
      />
      {giftAttributes && (
        <ConfirmDialog
          isOpen={Boolean(selectedId)}
          noDefaultTitle
          onClose={closeConfirmModal}
          confirmLabel={renderingModal?.gift.transferStars
            ? lang(
              'GiftTransferConfirmButton',
              { amount: formatStarsAsIcon(lang, renderingModal.gift.transferStars, { asFont: true }) },
              { withNodes: true },
            ) : lang('GiftTransferConfirmButtonFree')}
          confirmHandler={handleTransfer}
        >
          <div className={styles.header}>
            <div className={styles.giftPreview}>
              <RadialPatternBackground
                className={styles.backdrop}
                backgroundColors={[giftAttributes.backdrop!.centerColor, giftAttributes.backdrop!.edgeColor]}
                patternColor={giftAttributes.backdrop?.patternColor}
                patternIcon={giftAttributes.pattern?.sticker}
              />
              <AnimatedIconFromSticker
                className={styles.sticker}
                size={GIFT_STICKER_SIZE}
                sticker={giftAttributes.model?.sticker}
              />
            </div>
            <Icon name="next" className={styles.arrow} />
            <Avatar
              peer={renderingSelectedPeer}
              size={AVATAR_SIZE}
              className={styles.avatar}
            />
          </div>
          <p>
            {renderingModal?.gift.transferStars
              ? lang('GiftTransferConfirmDescription', {
                gift: lang('GiftUnique', { title: uniqueGift.title, number: uniqueGift.number }),
                amount: formatStarsAsText(lang, renderingModal.gift.transferStars),
                peer: getPeerTitle(lang, renderingSelectedPeer!),
              }, {
                withNodes: true,
                withMarkdown: true,
              })
              : lang('GiftTransferConfirmDescriptionFree', {
                gift: lang('GiftUnique', { title: uniqueGift.title, number: uniqueGift.number }),
                peer: getPeerTitle(lang, renderingSelectedPeer!),
              }, {
                withNodes: true,
                withMarkdown: true,
              })}
          </p>
        </ConfirmDialog>
      )}
    </PickerModal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { contactList, currentUserId } = global;

    return {
      contactIds: contactList?.userIds,
      currentUserId,
    };
  },
)(GiftTransferModal));
