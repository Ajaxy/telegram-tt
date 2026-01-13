import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiPeer } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectPeer } from '../../../../global/selectors';
import { REM } from '../../../common/helpers/mediaDimensions';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Avatar from '../../../common/Avatar';
import Icon from '../../../common/icons/Icon';
import ConfirmDialog from '../../../ui/ConfirmDialog';

import styles from './GiftAuctionChangeRecipientModal.module.scss';

export type OwnProps = {
  modal: TabState['giftAuctionChangeRecipientModal'];
};

type StateProps = {
  oldPeer?: ApiPeer;
  newPeer?: ApiPeer;
};

const AVATAR_SIZE = 4 * REM;

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
      <div className={styles.preview}>
        <Avatar peer={renderingOldPeer} size={AVATAR_SIZE} />
        <Icon name="next" className={styles.arrow} />
        <Avatar peer={renderingNewPeer} size={AVATAR_SIZE} />
      </div>
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
