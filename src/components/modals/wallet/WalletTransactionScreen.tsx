import { memo, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser, ApiWalletTransaction } from '../../../api/types';

import { getUserFullName } from '../../../global/helpers';
import {
  selectTabState, selectUser, selectWalletCurrency, selectWalletCurrencyRate, selectWalletResolvedUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { convertTonFromNanos, formatTonInFiat } from '../../../util/formatCurrency';
import { formatDateTime, secondsToDate } from '../../../util/localization/dateFormat';
import { formatAddressInGroups } from '../../../util/tonAddress';

import useClickable from '../../../hooks/useClickable';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import BadgeButton from '../../common/BadgeButton';
import GramIcon from '../../common/icons/GramIcon';
import Button from '../../ui/Button';
import TableInfo, { type TableData } from '../common/TableInfo';
import ExpandableTonAmount from './ExpandableTonAmount';
import WalletCollectibleImage from './WalletCollectibleImage';
import WalletDiamond from './WalletDiamond';
import WalletFeesInfoDialog from './WalletFeesInfoDialog';

import styles from './WalletTransactionScreen.module.scss';

import KeyIcon from '../../../assets/wallet-key.svg';

type OwnProps = {
  transaction: ApiWalletTransaction;
  // The whole modal when a transfer is opened from a chat
  isRoot?: boolean;
  onDecryptComment: NoneToVoidFunction;
  // With `userId`, the form opens on the user's current address rather than the one in the record
  onSend?: (recipient: string, userId?: string) => void;
  onDone: NoneToVoidFunction;
};

type StateProps = {
  currency: string;
  tonUsdRate?: number;
  currencyRate?: number;
  user?: ApiUser;
  decryptedComment?: string;
  isDecryptingComment?: boolean;
  freeTransfersPerDay?: number;
};

type AddressCellOwnProps = {
  address: string;
};

type DomainCellOwnProps = {
  domain: string;
};

const DIAMOND_SIZE = 120;

const WalletTransactionScreen = ({
  transaction, isRoot, currency, tonUsdRate, currencyRate, user, decryptedComment, isDecryptingComment,
  freeTransfersPerDay, onDecryptComment, onSend, onDone,
}: OwnProps & StateProps) => {
  const { loadWalletUserAddresses } = getActions();
  const lang = useLang();

  const [isFeesInfoOpen, openFeesInfo, closeFeesInfo] = useFlag();

  const {
    isIncoming, peer, amount, timestamp, comment, encryptedComment, fee, isGasless, isKeyChange, isPending,
    isFailed, collectible,
  } = transaction;

  useEffect(() => {
    if (peer.type === 'address') {
      loadWalletUserAddresses({ addresses: [peer.address] });
    }
  }, [peer]);

  // The hint about the daily free transfers belongs where the relayer paid
  const isFeeFree = Boolean(isGasless) && !fee;
  const canShowFeesInfo = isFeeFree && Boolean(freeTransfersPerDay);

  const tableData = useMemo(() => {
    const rows: TableData = [];

    // A provider paid from an address that is not theirs, and a key change moved no money
    const canSendTo = Boolean(onSend) && !isKeyChange && (peer.type === 'user' || peer.type === 'address');
    const sendToAddress = canSendTo ? peer.address : undefined;
    const sendButton = (recipient: string, userId?: string) => (
      <BadgeButton onClick={() => onSend!(recipient, userId)}>{lang('WalletSend')}</BadgeButton>
    );

    const peerLabel = lang(isIncoming ? 'WalletTransactionSender' : 'WalletTransactionRecipient');
    const domain = peer.type === 'unsupported' ? undefined : peer.domain;

    if (user) {
      rows.push([
        peerLabel,
        <span className={styles.peer}>
          <Avatar peer={user} size="small" />
          <span className={styles.peerText}>{getUserFullName(lang, user)}</span>
          {sendToAddress && sendButton(sendToAddress, peer.type === 'user' ? peer.userId : undefined)}
        </span>,
      ]);

      if (domain) {
        rows.push([lang('WalletTransactionDomain'), <DomainCell domain={domain} />]);
      }
    } else if (domain) {
      // The button sends to the address behind the domain, which the form takes without resolving it again
      rows.push([
        peerLabel,
        <span className={styles.peer}>
          <DomainCell domain={domain} />
          {sendToAddress && sendButton(sendToAddress)}
        </span>,
      ]);
    }

    if (peer.type === 'onramp') {
      rows.push([lang('WalletTransactionProvider'), peer.providerName]);
    }

    if (peer.type !== 'unsupported') {
      rows.push([
        lang('WalletTransactionAddress'),
        <span className={styles.peer}>
          <AddressCell address={peer.address} />
          {sendToAddress && !user && !domain && sendButton(sendToAddress)}
        </span>,
      ]);
    }

    if (fee !== undefined) {
      const fiatFee = formatTonInFiat(fee, tonUsdRate, currency, currencyRate, lang.code);

      rows.push([
        lang('WalletTransactionFee'),
        <span className={styles.fee}>
          <GramIcon isMono className={styles.feeIcon} />
          {isFeeFree ? lang('WalletTransactionFeeFree') : (
            <>
              <ExpandableTonAmount nanos={fee} />
              {fiatFee && <span className={styles.fiatFee}>{` ~ ${fiatFee}`}</span>}
            </>
          )}
          {canShowFeesInfo && (
            <Button
              round
              size="tiny"
              color="translucent"
              className={styles.feeInfoButton}
              iconName="help"
              ariaLabel={lang('WalletNetworkFeesTitle')}
              onClick={openFeesInfo}
            />
          )}
        </span>,
      ]);
    }

    rows.push([lang('WalletTransactionDate'), formatDateTime(
      lang,
      secondsToDate(timestamp),
      { date: 'short', time: 'short' },
    )]);

    const commentText = decryptedComment ?? comment;

    if (commentText) {
      rows.push([lang('WalletTransactionComment'), commentText]);
    } else if (encryptedComment) {
      rows.push([
        lang('WalletTransactionComment'),
        <Button
          isText
          size="tiny"
          className={buildClassName(styles.decryptButton, 'no-upper-case')}
          isLoading={isDecryptingComment}
          onClick={onDecryptComment}
        >
          {lang('WalletCommentEncrypted')}
        </Button>,
      ]);
    }

    return rows;
  }, [
    user, peer, isIncoming, isKeyChange, fee, isFeeFree, timestamp, comment, lang, tonUsdRate, currencyRate,
    currency, decryptedComment, encryptedComment, isDecryptingComment, canShowFeesInfo, onDecryptComment, onSend,
  ]);

  const fiatAmount = formatTonInFiat(amount, tonUsdRate, currency, currencyRate, lang.code);

  const sign = amount === 0n ? '' : isIncoming ? '+' : '−';

  return (
    <div className={styles.root}>
      {isKeyChange ? (
        <>
          <div className={styles.keyIcon}>
            <img src={KeyIcon} alt="" draggable={false} className={styles.keyIconImage} />
          </div>
          <div className={styles.title}>{lang('WalletTransactionKeyChange')}</div>
        </>
      ) : collectible ? (
        <>
          <WalletCollectibleImage collectible={collectible} isFull className={styles.collectible} />
          <div className={styles.title}>{collectible.name ?? lang('WalletCollectibleTitle')}</div>
        </>
      ) : (
        <>
          {/* The diamond stays invisible until it loads, so the wrapper reserves its space and the amount does not jump */}
          <div className={styles.diamond}>
            <WalletDiamond size={DIAMOND_SIZE} />
          </div>
          <div className={buildClassName(styles.amount, isIncoming && styles.positive)}>
            {lang('GramAmountText', {
              amount: (
                <span className={styles.amountValue}>
                  {sign}
                  <ExpandableTonAmount nanos={amount} fractionClassName={styles.amountFraction} />
                </span>
              ),
            }, { withNodes: true, pluralValue: convertTonFromNanos(amount) })}
          </div>
          {fiatAmount && <div className={styles.fiat}>{fiatAmount}</div>}
          {(isPending || isFailed) && (
            <div className={buildClassName(styles.status, isFailed && styles.failed)}>
              {lang(isFailed ? 'WalletTransactionFailed' : 'WalletTransactionSending')}
            </div>
          )}
        </>
      )}
      <TableInfo tableData={tableData} className={styles.table} />
      {canShowFeesInfo && (
        <WalletFeesInfoDialog
          isOpen={isFeesInfoOpen}
          fee={fee}
          freeTransfersPerDay={freeTransfersPerDay}
          onClose={closeFeesInfo}
        />
      )}
      <Button className={styles.okButton} pill onClick={onDone}>
        {lang(isRoot ? 'WalletTransactionOpenWallet' : 'OK')}
      </Button>
    </div>
  );
};

const DomainCell = ({ domain }: DomainCellOwnProps) => {
  return <span className={buildClassName(styles.peerText, styles.domain)}>{domain}</span>;
};

const AddressCell = ({ address }: AddressCellOwnProps) => {
  const { showNotification } = getActions();

  const handleClick = useLastCallback(() => {
    copyTextToClipboard(address);
    showNotification({ message: { key: 'WalletAddressCopied' } });
  });

  const clickableProps = useClickable<HTMLSpanElement>(handleClick);

  return (
    <span className={styles.address} {...clickableProps}>
      {formatAddressInGroups(address)}
    </span>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { transaction }): Complete<StateProps> => {
    const { peer } = transaction;
    const decryption = selectTabState(global).walletCommentDecryption;

    return {
      currency: selectWalletCurrency(global),
      tonUsdRate: global.appConfig.tonUsdRate,
      currencyRate: selectWalletCurrencyRate(global),
      user: peer.type === 'user' ? selectUser(global, peer.userId)
        : peer.type === 'address' ? selectWalletResolvedUser(global, peer.address) : undefined,
      decryptedComment: global.wallet?.decryptedComments?.[transaction.id],
      isDecryptingComment: decryption?.transactionId === transaction.id && decryption.status === 'pending',
      freeTransfersPerDay: global.appConfig.walletGaslessDailyTransfers,
    };
  },
)(WalletTransactionScreen));
