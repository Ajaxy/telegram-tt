import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiPeer } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectPeer } from '../../../../global/selectors';
import { formatStarsAsIcon, formatStarsAsText } from '../../../../util/localization/format';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import GiftTransferPreview from '../../../common/gift/GiftTransferPreview';
import ConfirmDialog from '../../../ui/ConfirmDialog';

export type OwnProps = {
  modal: TabState['giftTransferConfirmModal'];
};

type StateProps = {
  selectedPeer?: ApiPeer;
};

const GiftTransferConfirmModal = ({ modal, selectedPeer }: OwnProps & StateProps) => {
  const {
    closeGiftTransferConfirmModal, transferGift, openChat, closeGiftModal, closeGiftTransferModal,
  } = getActions();
  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const renderingSelectedPeer = useCurrentOrPrev(selectedPeer);

  const handleConfirm = useLastCallback(() => {
    if (!renderingModal?.gift.inputGift || !renderingModal.recipientId) return;

    transferGift({
      gift: renderingModal.gift.inputGift,
      recipientId: renderingModal.recipientId,
      transferStars: renderingModal.gift.transferStars,
    });

    closeGiftTransferConfirmModal();
    openChat({ id: renderingModal.recipientId });

    closeGiftModal();
    closeGiftTransferModal();
  });

  if (!renderingModal) return undefined;

  const { gift } = renderingModal;
  const uniqueGift = gift.gift.type === 'starGiftUnique' ? gift.gift : undefined;

  if (!uniqueGift) return undefined;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      noDefaultTitle
      onClose={closeGiftTransferConfirmModal}
      confirmLabel={gift.transferStars
        ? lang(
          'GiftTransferConfirmButton',
          { amount: formatStarsAsIcon(lang, gift.transferStars, { asFont: true }) },
          { withNodes: true },
        ) : lang('GiftTransferConfirmButtonFree')}
      confirmHandler={handleConfirm}
    >
      {renderingSelectedPeer && (
        <GiftTransferPreview
          peer={renderingSelectedPeer}
          gift={uniqueGift}
        />
      )}
      <p>
        {gift.transferStars
          ? lang('GiftTransferConfirmDescription', {
            gift: lang('GiftUnique', { title: uniqueGift.title, number: uniqueGift.number }),
            amount: formatStarsAsText(lang, gift.transferStars),
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
  );
};

export default memo(
  withGlobal<OwnProps>((global, { modal }): Complete<StateProps> => {
    const selectedPeer = modal?.recipientId ? selectPeer(global, modal.recipientId) : undefined;

    return {
      selectedPeer,
    };
  })(GiftTransferConfirmModal),
);
