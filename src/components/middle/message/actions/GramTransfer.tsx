import { memo, useEffect, useRef } from '../../../../lib/teact/teact';

import type { ApiMessageActionGramTransfer } from '../../../../api/types/messageActions';

import { IS_TOUCH_ENV } from '../../../../util/browser/windowEnvironment';
import buildClassName from '../../../../util/buildClassName';
import { formatTonShortFromNanos } from '../../../../util/formatCurrency';
import { splitAddressInHalves } from '../../../../util/tonAddress';

import useTimeout from '../../../../hooks/schedulers/useTimeout';
import useClickable from '../../../../hooks/useClickable';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useShowTransition from '../../../../hooks/useShowTransition';
import useShrinkToFit from '../../../../hooks/useShrinkToFit';

import GiftRibbon from '../../../common/gift/GiftRibbon';
import Spoiler from '../../../common/spoiler/Spoiler';
import Spinner from '../../../ui/Spinner';
import GramTransferDiamond from './GramTransferDiamond';

import styles from './GramTransfer.module.scss';

type OwnProps = {
  action: ApiMessageActionGramTransfer;
  peerName?: string;
  isOutgoing?: boolean;
  isSending?: boolean;
  isFailed?: boolean;
  isLoading?: boolean;
  shouldLoopStickers?: boolean;
  onClick?: NoneToVoidFunction;
};

// The sender key, the message key and a random prefix ahead of the text
const ENCRYPTED_COMMENT_OVERHEAD = 64;
const EN_DASH = '\u2013';
// The Android app's ribbon colors
const RIBBON_COLOR_IN = '#4bb9fe';
const RIBBON_COLOR_OUT = '#15be00';
const COIN_SIZE = 44;
const SHINE_MIN_DURATION = 600;
const SHINE_HIDE_DURATION = 320;

const GramTransfer = ({
  action, peerName, isOutgoing, isSending, isFailed, isLoading, shouldLoopStickers, onClick,
}: OwnProps) => {
  const lang = useLang();
  const [isHover, markHover, unmarkHover] = useFlag();

  const amountRef = useRef<HTMLDivElement>();
  const amountContentRef = useRef<HTMLDivElement>();

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

  const [whole, fraction] = formatTonShortFromNanos(amount).split('.');
  const groupedWhole = lang.number(Number(whole));
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
      className={buildClassName(styles.root, hasComment && styles.withComment)}
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
        />
        <div ref={amountRef} className={styles.amount}>
          <div ref={amountContentRef} className={styles.amountContent}>
            <span>
              {isOutgoing ? EN_DASH : '+'}
              {groupedWhole}
              {fraction && <span className={styles.amountFraction}>{`.${fraction}`}</span>}
            </span>
            <span className={styles.ticker}>{lang('ActionGramTransferTicker')}</span>
          </div>
        </div>
        {peerName && <div className={styles.peer}>{peerName}</div>}
        <div className={styles.address} aria-hidden>
          <span className={styles.addressLine}>{addressStart}</span>
          <span className={styles.addressLine}>{addressEnd}</span>
        </div>
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
      <GiftRibbon
        color={isFailed ? 'red' : isOutgoing ? RIBBON_COLOR_OUT : RIBBON_COLOR_IN}
        text={lang(ribbonTextKey)}
        className={styles.ribbon}
        textClassName={styles.ribbonText}
      />
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
