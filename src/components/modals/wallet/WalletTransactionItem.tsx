import { memo, useCallback, useRef } from '../../../lib/teact/teact';

import type {
  ApiPeer, ApiWalletCollectible, ApiWalletTransaction, ApiWalletTransactionPeer,
} from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { RegularLangKey } from '../../../types/language';
import type { LangFn } from '../../../util/localization';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getPeerFullTitle } from '../../../global/helpers/peers';
import { getWalletGiftMoveKey, getWalletPeerId } from '../../../global/helpers/wallet';
import { selectPeer } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateTime, secondsToDate } from '../../../util/localization/dateFormat';
import { shortenAddress } from '../../../util/tonAddress';
import renderText from '../../common/helpers/renderText';
import { sampleFrames, SETTLE_EASING } from './helpers/motion';
import { ROW_DIAMOND_SIZE } from './helpers/sendFlight';

import useSelector from '../../../hooks/data/useSelector';
import useClickable from '../../../hooks/useClickable';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import GramIcon from '../../common/icons/GramIcon';
import Icon from '../../common/icons/Icon';
import ExpandableTonAmount from './ExpandableTonAmount';
import { getOnrampProviderIcon } from './WalletBuyScreen';
import WalletCollectibleImage from './WalletCollectibleImage';
import WalletPendingClock from './WalletPendingClock';
import WalletRowOverlay from './WalletRowOverlay';
import WalletSendRowDiamond from './WalletSendRowDiamond';
import WalletSpinningDiamond from './WalletSpinningDiamond';

import styles from './WalletTransactionItem.module.scss';

type OwnProps = {
  transaction: ApiWalletTransaction;
  className?: string;
  onClick: (transaction: ApiWalletTransaction) => void;
};

const AVATAR_SIZE = 42;
const EXPAND_DURATION = 520;
const APPEAR_DURATION = 560;
const IMPACT_DURATION = 1200;
const IMPACT_DEPTH = 5;
const IMPACT_FREQUENCY = 2.2;
const IMPACT_DECAY = 200;
const APPEAR_FRAMES: Keyframe[] = [
  { opacity: 0, scale: '0.86', translate: '0 -1.375rem' },
  { opacity: 1, offset: 0.35 },
  { opacity: 1, scale: '1', translate: '0 0' },
];
// The landing diamond pushes the row down, and it springs back
const IMPACT_FRAMES = sampleFrames(IMPACT_DURATION, (time) => {
  const depth = IMPACT_DEPTH * Math.sin((2 * Math.PI * IMPACT_FREQUENCY * time) / 1000)
    * Math.exp(-time / IMPACT_DECAY);

  return { translate: `0 ${depth}px` };
});

const WalletTransactionItem = ({
  transaction, className, onClick,
}: OwnProps) => {
  const {
    isIncoming, peer, amount, comment, isPending, isFailed, timestamp, collectible,
  } = transaction;

  const lang = useLang();

  const peerId = getWalletPeerId(peer);
  const counterpartySelector = useCallback((global: GlobalState) => {
    return peerId ? selectPeer(global, peerId) : undefined;
  }, [peerId]);
  const counterparty = useSelector(counterpartySelector);

  const ref = useRef<HTMLDivElement>();
  const gramIconRef = useRef<HTMLSpanElement>();
  const [isSendRow, markSendRow] = useFlag();
  const [isBurstDone, markBurstDone] = useFlag();
  // The row of a transfer just queued may take the flying diamond and keeps it while pending. Other pending rows share
  // one spinning frame.
  const isQueued = transaction.id === transaction.localId;
  // The row the diamond has flown into keeps the mark while the chain confirms the transfer, and salutes then
  const isConfirmedSendRow = isSendRow && !isPending && !isFailed;

  // The row of a transfer that has just been sent opens up under the flying diamond
  const handleSendRowClaim = useLastCallback(() => {
    markSendRow();

    requestMeasure(() => {
      const root = ref.current;
      if (!root) return;

      const { paddingTop, paddingBottom } = getComputedStyle(root);
      const height = root.offsetHeight;

      requestMutation(() => {
        root.animate([
          { height: '0px', paddingTop: '0px', paddingBottom: '0px' },
          { height: `${height}px`, paddingTop, paddingBottom },
        ], { duration: EXPAND_DURATION, easing: SETTLE_EASING });
        root.animate(APPEAR_FRAMES, { duration: APPEAR_DURATION, easing: SETTLE_EASING });
      });
    });
  });

  const handleSendRowLand = useLastCallback(() => {
    requestMutation(() => {
      ref.current?.animate(IMPACT_FRAMES, IMPACT_DURATION);
    });
  });

  const onrampIcon = peer.type === 'onramp' ? getOnrampProviderIcon(peer.providerName).icon : undefined;
  const title = getTitle(lang, peer, counterparty);
  const description = comment
    || (peer.type === 'onramp' ? capitalizeName(peer.providerName) : lang(getDescriptionKey(transaction)));
  const status = isPending ? lang('WalletTransactionSending') : isFailed ? lang('WalletTransactionFailed') : undefined;

  const handleClick = useLastCallback(() => {
    onClick(transaction);
  });
  const clickableProps = useClickable<HTMLDivElement>(handleClick);

  return (
    <div
      ref={ref}
      className={buildClassName(styles.root, isPending && styles.pending, className)}
      {...clickableProps}
    >
      {isPending && isSendRow && (
        <div className={styles.sheen}>
          <div className={styles.sheenRing} />
        </div>
      )}
      {isConfirmedSendRow && !isBurstDone && (
        <WalletRowOverlay originRef={gramIconRef} onEnd={markBurstDone} />
      )}
      <div className={styles.preview}>
        {counterparty ? (
          <Avatar peer={counterparty} size={AVATAR_SIZE} />
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
        {isPending && (
          <div className={styles.pendingBadge}>
            <WalletPendingClock />
          </div>
        )}
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{renderText(title)}</h3>
        <p className={styles.description}>{renderText(description)}</p>
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
              {isPending && (isQueued || isSendRow) ? (
                <WalletSendRowDiamond
                  size={ROW_DIAMOND_SIZE}
                  isQueued={isQueued}
                  className={styles.pendingDiamond}
                  onClaim={handleSendRowClaim}
                  onLand={handleSendRowLand}
                />
              ) : isPending ? (
                <WalletSpinningDiamond size={ROW_DIAMOND_SIZE} className={styles.pendingDiamond} />
              ) : (
                <span
                  ref={gramIconRef}
                  className={buildClassName(styles.gramIconBox, isConfirmedSendRow && styles.gramIconPop)}
                >
                  <GramIcon className={styles.gramIcon} />
                </span>
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

function getTitle(lang: LangFn, peer: ApiWalletTransactionPeer, counterparty?: ApiPeer) {
  if (counterparty) return getPeerFullTitle(lang, counterparty);

  switch (peer.type) {
    case 'onramp':
      return lang(getOnrampProviderIcon(peer.providerName).icon === 'walt'
        ? 'WalletTransactionTopUpCrypto'
        : 'WalletTransactionTopUp');
    case 'telegramGift':
      return lang('Telegram');
    case 'unsupported':
      return lang('WalletTransactionUnsupportedPeer');
    default:
      return peer.domain || shortenAddress(peer.address);
  }
}

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

function getDescriptionKey(transaction: ApiWalletTransaction): RegularLangKey {
  const { encryptedComment, isKeyChange, collectible, peer, isIncoming } = transaction;
  const giftMoveKey = getWalletGiftMoveKey(transaction);
  if (giftMoveKey) return giftMoveKey;

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
