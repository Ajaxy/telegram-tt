import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiPeer } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectPeer } from '../../../../global/selectors';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import TransferBetweenPeers from '../../../common/TransferBetweenPeers';
import ConfirmDialog from '../../../ui/ConfirmDialog';

export type OwnProps = {
  modal: TabState['giftAuctionChangeRecipientModal'];
};

type StateProps = {
  oldPeer?: ApiPeer;
  newPeer?: ApiPeer;
};

const GiftAuctionChangeRecipientModal = ({ modal, oldPeer, newPeer }: OwnProps & StateProps) => {
  const { closeGiftAuctionChangeRecipientModal, openGiftAuctionBidModal } = getActions();
  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingOldPeer = useCurrentOrPrev(oldPeer);
  const renderingNewPeer = useCurrentOrPrev(newPeer);
  const renderingModal = useCurrentOrPrev(modal);

  const handleConfirm = useLastCallback(() => {
    if (!renderingModal?.auctionGiftId) return;

    closeGiftAuctionChangeRecipientModal();
    openGiftAuctionBidModal({
      auctionGiftId: renderingModal.auctionGiftId,
      peerId: renderingModal.newPeerId,
      message: renderingModal.message,
      shouldHideName: renderingModal.shouldHideName,
    });
  });

  if (!renderingOldPeer || !renderingNewPeer) return undefined;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={lang('GiftAuctionChangeRecipientTitle')}
      onClose={closeGiftAuctionChangeRecipientModal}
      confirmLabel={lang('Continue')}
      confirmHandler={handleConfirm}
    >
      <TransferBetweenPeers fromPeer={renderingOldPeer} toPeer={renderingNewPeer} />
      <p>
        {lang('GiftAuctionChangeRecipientDescription', {
          oldPeer: getPeerTitle(lang, renderingOldPeer),
          newPeer: getPeerTitle(lang, renderingNewPeer),
        }, {
          withNodes: true,
          withMarkdown: true,
        })}
      </p>
    </ConfirmDialog>
  );
};

export default memo(
  withGlobal<OwnProps>((global, { modal }): Complete<StateProps> => {
    const oldPeer = modal?.oldPeerId ? selectPeer(global, modal.oldPeerId) : undefined;
    const newPeer = modal?.newPeerId ? selectPeer(global, modal.newPeerId) : undefined;

    return {
      oldPeer,
      newPeer,
    };
  })(GiftAuctionChangeRecipientModal),
);
