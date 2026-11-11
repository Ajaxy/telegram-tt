import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';

import type { ApiMessageActionGramTransfer } from '../../../../api/types/messageActions';

import { getIsWalletTransferConfirmed, getPendingWalletTransfer } from '../../../../global/helpers/wallet';
import { selectWalletTransactions } from '../../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../../util/browser/windowEnvironment';
import buildClassName from '../../../../util/buildClassName';
import { formatTonParts } from '../../../../util/localization/format';
import { splitAddressInHalves } from '../../../../util/tonAddress';

import useSelector from '../../../../hooks/data/useSelector';
import useTimeout from '../../../../hooks/schedulers/useTimeout';
import useClickable from '../../../../hooks/useClickable';
import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useShowTransition from '../../../../hooks/useShowTransition';
import useShrinkToFit from '../../../../hooks/useShrinkToFit';

import Spoiler from '../../../common/spoiler/Spoiler';
import WalletPendingClock from '../../../modals/wallet/WalletPendingClock';
import Spinner from '../../../ui/Spinner';
import GramTransferDiamond from './GramTransferDiamond';
import GramTransferRibbon from './GramTransferRibbon';

import styles from './GramTransfer.module.scss';

type OwnProps = {
  action: ApiMessageActionGramTransfer;
  // The id the card had before the server took it, or its own id while it is still local
  localMessageId?: number;
  peerName?: string;
  isOutgoing?: boolean;
  isSending?: boolean;
  isFailed?: boolean;
  isLoading?: boolean;
  shouldLoopStickers?: boolean;
  // A transfer the wallet is asked to make: the card alone, with no status and nothing to open
  isRequest?: boolean;
  onClick?: NoneToVoidFunction;
};

// The sender key, the message key and a random prefix ahead of the text
const ENCRYPTED_COMMENT_OVERHEAD = 64;
const EN_DASH = '\u2013';
// The rounded font's dash has almost no side bearing, so it would touch the digits
const THIN_SPACE = '\u2009';
// The Android app's ribbon colors; a failed transfer takes the red of the theme there as well
const RIBBON_COLOR_IN = '#4bb9fe';
const RIBBON_COLOR_OUT = '#15be00';
const RIBBON_COLOR_FAILED = 'var(--color-error)';
const COIN_SIZE = 44;
const SHINE_MIN_DURATION = 600;
const SHINE_HIDE_DURATION = 320;

const GramTransfer = ({
  action, localMessageId, peerName, isOutgoing, isSending, isFailed, isLoading, shouldLoopStickers, isRequest, onClick,
}: OwnProps) => {
  const lang = useLang();
  const [isHover, markHover, unmarkHover] = useFlag();

  const amountRef = useRef<HTMLDivElement>();
  const amountContentRef = useRef<HTMLDivElement>();
  const peerRef = useRef<HTMLDivElement>();
  const addressRef = useRef<HTMLDivElement>();

  useShrinkToFit(amountRef, amountContentRef);

  const [isShineHeld, holdShine, releaseShine] = useFlag();
  // Once the transfer is sent, the background stays at the angle it reached instead of jumping back
  const [isRotated, markRotated] = useFlag();

  useEffect(() => {
    if (!isSending) return;

    holdShine();
    markRotated();
  }, [isSending]);

  useTimeout(releaseShine, isShineHeld ? SHINE_MIN_DURATION : undefined);

  const { ref: shineRef, shouldRender: shouldRenderShine } = useShowTransition({
    isOpen: isSending || isShineHeld,
    withShouldRender: true,
    className: false,
    closeDuration: SHINE_HIDE_DURATION,
  });

  const {
    amount, peerAddress, comment, encryptedComment,
  } = action;

  const walletTransactions = useSelector(selectWalletTransactions);
  // As in the native apps, a clock replaces the ribbon until the chain confirms the transfer
  const pendingTransfer = useMemo(
    () => (localMessageId !== undefined && !isFailed
      ? getPendingWalletTransfer(walletTransactions, localMessageId)
      : undefined),
    [isFailed, walletTransactions, localMessageId],
  );
  const isInProgress = isSending || Boolean(pendingTransfer);

  const [burstKey, setBurstKey] = useState(0);

  useEffectWithPrevDeps(([prevPendingTransfer]) => {
    if (!prevPendingTransfer?.localId || pendingTransfer) return;

    if (getIsWalletTransferConfirmed(walletTransactions, prevPendingTransfer.localId)) {
      setBurstKey((key) => key + 1);
    }
  }, [pendingTransfer, walletTransactions]);

  const getLensText = useLastCallback(() => (
    [amountContentRef.current, peerRef.current, addressRef.current].filter(Boolean)
  ));

  const { ref: clockRef, shouldRender: shouldRenderClock } = useShowTransition({
    isOpen: isInProgress && !isRequest, withShouldRender: true, noMountTransition: true,
  });
  const { ref: ribbonRef, shouldRender: shouldRenderRibbon } = useShowTransition({
    isOpen: !isInProgress && !isRequest, withShouldRender: true, noMountTransition: true,
  });

  // A request shows every nanoton the wallet is asked for; a chat card keeps the short form
  const [whole, fraction] = formatTonParts(lang, amount, !isRequest);
  const [addressStart, addressEnd] = splitAddressInHalves(peerAddress);

  // The server cannot read an encrypted comment, so the spoiler length is estimated from the payload size
  const hiddenLength = encryptedComment
    ? Math.max(1, countBase64Bytes(encryptedComment) - ENCRYPTED_COMMENT_OVERHEAD)
    : 0;
  const hasComment = Boolean(comment) || hiddenLength > 0;
  const ribbonTextKey = isFailed ? 'WalletTransactionFailed'
    : isOutgoing ? 'ActionGramTransferSent' : 'ActionGramTransferReceived';
  const clickableProps = useClickable<HTMLDivElement>(onClick);

  return (
    <div
      className={buildClassName(styles.root, hasComment && styles.withComment, isRequest && styles.request)}
      {...clickableProps}
      onMouseEnter={!IS_TOUCH_ENV ? markHover : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? unmarkHover : undefined}
    >
      <div className={styles.card}>
        <div className={buildClassName(styles.gradient, isRotated && styles.spinning, !isSending && styles.paused)} />
        <GramTransferDiamond
          size={COIN_SIZE}
          className={styles.icon}
          isHovered={isHover}
          shouldLoopStickers={shouldLoopStickers}
          burstKey={burstKey}
          getLensText={getLensText}
        />
        <div ref={amountRef} className={styles.amount}>
          <div ref={amountContentRef} className={styles.amountContent}>
            <span>
              {isOutgoing ? EN_DASH : '+'}
              {THIN_SPACE}
              {whole}
              {fraction && <span className={styles.amountFraction}>{fraction}</span>}
            </span>
            <span className={styles.ticker}>{lang('ActionGramTransferTicker')}</span>
          </div>
        </div>
        {peerName && <div ref={peerRef} className={styles.peer}>{peerName}</div>}
        <div ref={addressRef} className={styles.address} aria-hidden>
          <span className={styles.addressLine}>{addressStart}</span>
          <span className={styles.addressLine}>{addressEnd}</span>
        </div>
        {/* The halves read as two words, so a screen reader gets the address whole */}
        {peerAddress && <span className="visually-hidden">{peerAddress}</span>}
        {shouldRenderShine && (
          <div ref={shineRef} className={styles.shine} aria-hidden>
            <div className={styles.shineStroke} />
          </div>
        )}
        {isLoading && (
          <div className={styles.loading}>
            <Spinner color="white" />
          </div>
        )}
      </div>
      {shouldRenderClock && (
        <div ref={clockRef} className={styles.clock}>
          <WalletPendingClock />
        </div>
      )}
      {shouldRenderRibbon && (
        <div ref={ribbonRef} className={styles.ribbon}>
          <GramTransferRibbon
            color={isFailed ? RIBBON_COLOR_FAILED : isOutgoing ? RIBBON_COLOR_OUT : RIBBON_COLOR_IN}
            text={lang(ribbonTextKey)}
          />
        </div>
      )}
      {comment && <div className={styles.comment}>{comment}</div>}
      {hiddenLength > 0 && (
        <div className={styles.comment}>
          <Spoiler>{'a'.repeat(hiddenLength)}</Spoiler>
        </div>
      )}
    </div>
  );
};

function countBase64Bytes(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;

  return Math.floor((base64.length * 3) / 4) - padding;
}

export default memo(GramTransfer);
