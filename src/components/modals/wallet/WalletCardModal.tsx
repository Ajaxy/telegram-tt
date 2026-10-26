import {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser, ApiWalletCard } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import {
  selectCanAnimateInterface,
  selectCanSendMoneyToUser,
  selectIsWalletAvailable,
  selectUser,
  selectUserFullInfo,
  selectWalletCurrency,
  selectWalletCurrencyRate,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import useWalletCardFlight from './useWalletCardFlight';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import WalletAddressQrModal from './WalletAddressQrModal';
import WalletCard from './WalletCard';

import styles from './WalletCardModal.module.scss';

export type OwnProps = {
  modal: TabState['walletCardModal'];
};

type StateProps = {
  user?: ApiUser;
  walletCard?: ApiWalletCard;
  tonUsdRate?: number;
  currency: string;
  currencyRate?: number;
  canSendMoney?: boolean;
  isWalletAvailable?: boolean;
  canAnimate?: boolean;
};

const WalletCardModal = ({
  modal, user, walletCard, tonUsdRate, currency, currencyRate, canSendMoney, isWalletAvailable, canAnimate,
}: OwnProps & StateProps) => {
  const { closeWalletCardModal, openWalletTransferLink, openWalletModal } = getActions();

  const lang = useLang();

  const cardRef = useRef<HTMLDivElement>();
  const poseRef = useRef<HTMLDivElement>();
  const buttonRef = useRef<HTMLButtonElement>();
  const isOpen = Boolean(modal && walletCard);

  // Kept per opening, so the code closes with the card and does not come back when the card opens again
  const [qrModal, setQrModal] = useState<OwnProps['modal']>();
  const isQrOpen = isOpen && qrModal === modal;

  const renderingUser = useCurrentOrPrev(user);
  const renderingCard = useCurrentOrPrev(walletCard);
  const renderingCanSendMoney = useCurrentOrPrev(canSendMoney);

  useWalletCardFlight({
    cardRef, poseRef, buttonRef, userId: renderingUser?.id, isOpen, isAnimated: canAnimate,
  });

  // Without its card the modal hides, and a card that comes later would open it again unasked
  useEffect(() => {
    if (modal && !walletCard) closeWalletCardModal();
  }, [modal, walletCard]);

  const handleSendMoney = useLastCallback(() => {
    openWalletTransferLink({ userId: renderingUser!.id, shouldCloseAfterSend: true, shouldCloseOnBack: true });
    closeWalletCardModal();
  });

  const handleOpenWallet = useLastCallback(() => {
    openWalletModal();
    closeWalletCardModal();
  });

  const handleQrClick = useLastCallback(() => {
    setQrModal(modal);
  });

  const handleQrClose = useLastCallback(() => {
    setQrModal(undefined);
  });

  const ownerName = getUserFullName(lang, renderingUser);

  return (
    <Modal
      isOpen={isOpen}
      className={buildClassName(styles.root, canAnimate && styles.flying)}
      dialogClassName={styles.dialog}
      contentClassName={styles.content}
      onClose={closeWalletCardModal}
    >
      {renderingCard && (
        <div ref={cardRef} className={styles.cardFlight}>
          <div ref={poseRef} className={styles.cardPose}>
            <WalletCard
              address={renderingCard.address}
              ownerName={ownerName}
              balance={renderingCard.balance}
              usdRate={tonUsdRate}
              currency={currency}
              currencyRate={currencyRate}
              stickers={renderingCard.stickers}
              backgroundGift={renderingCard.backgroundGift}
              onQrClick={handleQrClick}
            />
          </div>
        </div>
      )}
      {renderingCard && (
        <WalletAddressQrModal
          isOpen={isQrOpen}
          address={renderingCard.address}
          title={renderingUser?.isSelf ? lang('WalletReceiveTitle') : ownerName!}
          isPeer={!renderingUser?.isSelf}
          onClose={handleQrClose}
        />
      )}
      {renderingUser?.isSelf ? isWalletAvailable && (
        <Button ref={buttonRef} className={styles.button} pill fluid onClick={handleOpenWallet}>
          {lang('WalletTransactionOpenWallet')}
        </Button>
      ) : renderingCanSendMoney && (
        <Button
          ref={buttonRef}
          className={styles.button}
          pill
          fluid
          iconName="gram"
          iconClassName={styles.sendIcon}
          onClick={handleSendMoney}
        >
          {lang('WalletSendMoney')}
        </Button>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const userId = modal?.userId;

    return {
      user: userId ? selectUser(global, userId) : undefined,
      walletCard: userId ? selectUserFullInfo(global, userId)?.walletCard : undefined,
      tonUsdRate: global.appConfig.tonUsdRate,
      currency: selectWalletCurrency(global),
      currencyRate: selectWalletCurrencyRate(global),
      canSendMoney: userId ? selectCanSendMoneyToUser(global, userId) : undefined,
      isWalletAvailable: selectIsWalletAvailable(global),
      canAnimate: selectCanAnimateInterface(global),
    };
  },
)(WalletCardModal));
