import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiCountryCode, ApiUser, ApiWalletGiftDeposit } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { GRAM_TRANSFER_FEE_RESERVE } from '../../../config';
import { getUserFullName, WALLET_ERROR_LANG_KEYS } from '../../../global/helpers';
import { selectTabState, selectUser } from '../../../global/selectors';
import { getBigIntMax } from '../../../util/numbers';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import GiftMoveDestination, { type GiftMoveDestinationStep } from '../../common/gift/GiftMoveDestination';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Spinner from '../../ui/Spinner';
import ExpandableTonAmount from './ExpandableTonAmount';

import styles from './WalletMoveToGiftsDialog.module.scss';

type OwnProps = {
  isOpen: boolean;
  onConfirm: (deposit: ApiWalletGiftDeposit) => void;
  onClose: NoneToVoidFunction;
};

const DESTINATION_PATH: GiftMoveDestinationStep[] = [
  { icon: 'user', labelKey: 'MenuMyProfile' },
  { icon: 'gift', labelKey: 'ProfileTabGifts' },
];

type StateProps = {
  currentUser?: ApiUser;
  phoneCodeList: ApiCountryCode[];
  balance?: bigint;
  giftDeposit?: TabState['walletGiftDeposit'];
  isSending?: boolean;
};

const WalletMoveToGiftsDialog = ({
  isOpen, currentUser, phoneCodeList, balance, giftDeposit, isSending, onConfirm, onClose,
}: OwnProps & StateProps) => {
  const lang = useLang();

  const { deposit, error, errorKey, isLoading } = giftDeposit || {};
  const fee = deposit?.fee;

  const isInsufficient = Boolean(deposit && fee !== undefined && balance !== undefined
    && deposit.amount + getBigIntMax(fee, GRAM_TRANSFER_FEE_RESERVE) > balance);

  // Sent without a known fee, the transfer could fail on the chain with the fee spent
  const canMove = Boolean(deposit && fee !== undefined && !isInsufficient);
  const isBusy = isLoading || isSending;

  const phone = currentUser?.phoneNumber && formatPhoneNumberWithCode(phoneCodeList, currentUser.phoneNumber);

  function renderStatus() {
    if (errorKey) return lang.withRegular(errorKey);

    if (error) return lang(WALLET_ERROR_LANG_KEYS[error]);

    if (!deposit) return undefined;

    if (fee === undefined) return lang('WalletSendFeeUnavailable');

    if (isInsufficient) return lang('WalletSendInsufficientFunds');

    return lang(
      'WalletSendNetworkFee',
      { amount: <ExpandableTonAmount nanos={fee} withTicker /> },
      { withNodes: true },
    );
  }

  const status = renderStatus();

  const handleConfirm = useLastCallback(() => {
    onConfirm(deposit!);
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={lang('WalletMoveToGifts')}
      text={lang('WalletMoveToGiftsText')}
      confirmLabel={(
        <>
          {lang('GiftMoveButton')}
          {isBusy && <Spinner className={styles.moveSpinner} />}
        </>
      )}
      isConfirmDisabled={!canMove || isBusy}
      confirmHandler={handleConfirm}
      onClose={onClose}
    >
      {currentUser && (
        <div className={styles.account}>
          <Avatar peer={currentUser} size="medium" />
          <div className={styles.accountInfo}>
            <div className={styles.accountName}>{getUserFullName(lang, currentUser)}</div>
            {phone && <div className={styles.accountPhone}>{phone}</div>}
          </div>
        </div>
      )}
      <GiftMoveDestination path={DESTINATION_PATH} />
      <div className={styles.status}>{status}</div>
    </ConfirmDialog>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);

    return {
      currentUser: global.currentUserId ? selectUser(global, global.currentUserId) : undefined,
      phoneCodeList: global.countryList.phoneCodes,
      balance: global.wallet?.state?.balance,
      giftDeposit: tabState.walletGiftDeposit,
      isSending: tabState.walletTransfer?.status === 'pending',
    };
  },
)(WalletMoveToGiftsDialog));
