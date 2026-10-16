import { memo } from '../../../lib/teact/teact';

import type {
  ApiUser, ApiWalletCollectible, ApiWalletTransaction,
} from '../../../api/types';
import type { RegularLangKey } from '../../../types/language';

import { getUserFullName } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatDateTime, secondsToDate } from '../../../util/localization/dateFormat';
import { shortenAddress } from '../../../util/tonAddress';

import useClickable from '../../../hooks/useClickable';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import GramIcon from '../../common/icons/GramIcon';
import Icon from '../../common/icons/Icon';
import ExpandableTonAmount from './ExpandableTonAmount';
import { getOnrampProviderIcon } from './WalletBuyScreen';
import WalletCollectibleImage from './WalletCollectibleImage';
import WalletSpinningDiamond from './WalletSpinningDiamond';

import styles from './WalletTransactionItem.module.scss';

type OwnProps = {
  transaction: ApiWalletTransaction;
  user?: ApiUser;
  onClick: (transaction: ApiWalletTransaction) => void;
};

const AVATAR_SIZE = 42;
// 40dp as on Android
const PENDING_DIAMOND_SIZE = 40;

const WalletTransactionItem = ({ transaction, user, onClick }: OwnProps) => {
  const {
    isIncoming, peer, amount, comment, isPending, isFailed, timestamp, collectible,
  } = transaction;

  const lang = useLang();

  const onrampIcon = peer.type === 'onramp' ? getOnrampProviderIcon(peer.providerName).icon : undefined;
  const title = user
    ? getUserFullName(lang, user)
    : peer.type === 'onramp'
      ? lang(onrampIcon === 'walt' ? 'WalletTransactionTopUpCrypto' : 'WalletTransactionTopUp')
      : peer.type !== 'unsupported'
        ? peer.domain || shortenAddress(peer.address)
        : lang('WalletTransactionUnsupportedPeer');
  const description = comment
    || (peer.type === 'onramp' ? capitalizeName(peer.providerName) : lang(getDescriptionKey(transaction)));
  const status = isPending ? lang('WalletTransactionSending') : isFailed ? lang('WalletTransactionFailed') : undefined;

  const handleClick = useLastCallback(() => {
    onClick(transaction);
  });
  const clickableProps = useClickable<HTMLDivElement>(handleClick);

  return (
    <div className={buildClassName(styles.root, isPending && styles.pending)} {...clickableProps}>
      <div className={styles.preview}>
        {user ? (
          <Avatar peer={user} size={AVATAR_SIZE} />
        ) : (
          <div className={buildClassName(styles.direction, isIncoming ? styles.directionIn : styles.directionOut)}>
            {onrampIcon ? (
              <Icon name={onrampIcon} className={styles.directionIcon} />
            ) : (
              <Icon
                name="arrow-up-circle-filled"
                className={buildClassName(styles.directionIcon, isIncoming && styles.directionIconDown)}
              />
            )}
          </div>
        )}
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
        {collectible && (
          <div className={styles.collectible}>
            <WalletCollectibleImage collectible={collectible} className={styles.collectibleImage} />
            <div className={styles.collectibleInfo}>
              <span className={styles.collectibleName}>{collectible.name ?? lang('WalletCollectibleTitle')}</span>
              <span className={styles.collectibleKind}>{lang(getCollectibleTypeKey(collectible.type))}</span>
            </div>
          </div>
        )}
        <p className={styles.date}>
          {formatDateTime(
            lang,
            secondsToDate(timestamp),
            { date: 'short', time: 'short' },
          )}
        </p>
      </div>
      <span className={styles.after}>
        <span
          className={buildClassName(
            styles.amount,
            isPending && !collectible && styles.amountPending,
            isIncoming ? styles.positive : styles.negative,
          )}
        >
          {collectible ? (
            <>
              {lang(isIncoming ? 'WalletCollectibleItemIn' : 'WalletCollectibleItemOut')}
              <Icon name="gift" className={styles.collectibleIcon} />
            </>
          ) : (
            <>
              {amount !== 0n && (isIncoming ? '+' : '−')}
              <ExpandableTonAmount nanos={amount} />
              {isPending ? (
                <WalletSpinningDiamond size={PENDING_DIAMOND_SIZE} className={styles.pendingDiamond} />
              ) : (
                <GramIcon className={styles.gramIcon} />
              )}
            </>
          )}
        </span>
        {status && (
          <span className={buildClassName(styles.status, isFailed && styles.statusFailed)}>{status}</span>
        )}
      </span>
    </div>
  );
};

function getCollectibleTypeKey(type: ApiWalletCollectible['type']): RegularLangKey {
  switch (type) {
    case 'gift':
      return 'WalletCollectibleGift';
    case 'username':
      return 'WalletCollectibleUsername';
    case 'number':
      return 'WalletCollectibleNumber';
    default:
      return 'WalletCollectibleTitle';
  }
}

// The provider arrives in lower case
function capitalizeName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getDescriptionKey({
  encryptedComment, isKeyChange, collectible, peer, isIncoming,
}: ApiWalletTransaction): RegularLangKey {
  if (encryptedComment) return 'WalletCommentEncrypted';

  if (isKeyChange) return 'WalletTransactionKeyChange';

  if (collectible) {
    return isIncoming ? 'WalletTransactionIncomingCollectible' : 'WalletTransactionOutgoingCollectible';
  }

  if (peer.type === 'user') {
    return isIncoming ? 'WalletTransactionIncoming' : 'WalletTransactionOutgoing';
  }

  return isIncoming ? 'WalletTransactionDeposit' : 'WalletTransactionWithdrawal';
}

export default memo(WalletTransactionItem);
