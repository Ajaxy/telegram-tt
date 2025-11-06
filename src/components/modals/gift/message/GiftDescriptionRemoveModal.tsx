import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiPeer } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { selectPeer } from '../../../../global/selectors';
import { formatStarsAsIcon } from '../../../../util/localization/format';
import { renderGiftOriginalInfo } from '../../../common/helpers/giftOriginalInfo';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import ConfirmDialog from '../../../ui/ConfirmDialog';

import styles from './GiftDescriptionRemoveModal.module.scss';

export type OwnProps = {
  modal: TabState['giftDescriptionRemoveModal'];
};

type StateProps = {
  senderPeer?: ApiPeer;
  recipientPeer?: ApiPeer;
};

const GiftDescriptionRemoveModal = ({
  modal, senderPeer, recipientPeer,
}: OwnProps & StateProps) => {
  const {
    closeGiftDescriptionRemoveModal, removeGiftDescription, openChat,
  } = getActions();
  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const renderingSenderPeer = useCurrentOrPrev(senderPeer);
  const renderingRecipientPeer = useCurrentOrPrev(recipientPeer);

  const openChatHandler = useLastCallback((id: string) => {
    closeGiftDescriptionRemoveModal();
    openChat({ id });
  });

  const handleConfirm = useLastCallback(() => {
    if (!renderingModal?.gift.inputGift || !renderingModal.price) return;

    removeGiftDescription({
      gift: renderingModal.gift.inputGift,
      price: renderingModal.price,
    });
  });

  if (!renderingModal || !renderingRecipientPeer) return undefined;

  const { price, details } = renderingModal;

  const description = renderGiftOriginalInfo({
    originalDetails: details, recipient: renderingRecipientPeer,
    sender: renderingSenderPeer, onOpenChat: openChatHandler, lang,
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={lang('RemoveGiftDescriptionTitle')}
      onClose={closeGiftDescriptionRemoveModal}
      confirmLabel={lang('RemoveGiftDescriptionButton', {
        amount: formatStarsAsIcon(lang, price, { asFont: true }),
      }, { withNodes: true })}
      confirmHandler={handleConfirm}
    >
      <div className={styles.confirmText}>{lang('RemoveGiftDescriptionConfirmText')}</div>
      {Boolean(description) && (
        <div className={styles.giftDescription}>
          {description}
        </div>
      )}
    </ConfirmDialog>
  );
};

export default memo(
  withGlobal<OwnProps>((global, { modal }): Complete<StateProps> => {
    const senderPeer = modal?.details.senderId ? selectPeer(global, modal.details.senderId) : undefined;
    const recipientPeer = modal?.details.recipientId ? selectPeer(global, modal.details.recipientId) : undefined;

    return {
      senderPeer,
      recipientPeer,
    };
  })(GiftDescriptionRemoveModal),
);
