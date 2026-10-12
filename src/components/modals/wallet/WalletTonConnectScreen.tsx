import { memo, useState } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';

import { WALLET_ERROR_LANG_KEYS } from '../../../global/helpers/wallet';
import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { formatTonFromNanos } from '../../../util/formatCurrency';
import { getServerTime } from '../../../util/serverTime';

import useInterval from '../../../hooks/schedulers/useInterval';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Skeleton from '../../ui/placeholder/Skeleton';
import Spinner from '../../ui/Spinner';
import Transition from '../../ui/Transition';
import ExpandableTonAmount from './ExpandableTonAmount';
import WalletAppIcon from './WalletAppIcon';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';
import Control, { ControlDescription, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island, { IslandDescription } from '@gili/layout/Island';

import styles from './WalletTonConnectScreen.module.scss';

type OwnProps = {
  flow?: TabState['walletTonConnect'];
  onUnlock: NoneToVoidFunction;
  onConfirm: NoneToVoidFunction;
  onDecline: NoneToVoidFunction;
};

type AppHostOwnProps = {
  url?: string;
};

const CLOCK_INTERVAL = 1000;

const WalletTonConnectScreen = ({
  flow, onUnlock, onConfirm, onDecline,
}: OwnProps) => {
  const { showNotification } = getActions();

  const lang = useLang();

  const [now, setNow] = useState(getServerTime);
  const {
    session, connectRequest, request, preview, error, status, isDeclining,
  } = flow || {};
  const requestExpires = preview?.expires ?? request?.expires;
  const expires = requestExpires === undefined ? undefined
    : Math.min(requestExpires, preview?.transaction?.validUntil ?? requestExpires);
  const isExpired = expires !== undefined && expires <= now;
  useInterval(() => setNow(getServerTime()), expires && !isExpired ? CLOCK_INTERVAL : undefined);

  // An answered request keeps its spinner while the dialog fades out
  const isLoading = status === 'pending' || status === 'done';
  const isClosed = session?.isClosed || session?.isClosing;
  const manifest = session?.manifest;
  const name = manifest?.name || lang('WalletConnectApp');
  const hasManifestError = Boolean(session?.manifestError);

  // Without the simulation the fee is unknown, and a failed one usually means the transfer would fail on the chain
  const isSimulated = Boolean(preview?.transaction && !preview.isInvalid && preview.fee !== undefined);

  // Neither signing data nor a signed message is simulated: the dApp relays the message later and pays the gas
  const signData = preview?.signData;
  const isSignMessage = preview?.request.method === 'signMessage';
  const canSignMessage = isSignMessage && Boolean(preview.transaction);
  const canConfirm = !isClosed && !isExpired && !hasManifestError
    && (Boolean(connectRequest && manifest) || isSimulated || Boolean(signData) || canSignMessage);
  const errorKey = hasManifestError ? 'WalletConnectManifestError'
    : isClosed ? 'WalletConnectSessionClosed'
      : isExpired ? 'WalletConnectExpired' : error ? WALLET_ERROR_LANG_KEYS[error] : undefined;
  const blindData = signData?.type === 'binary' ? signData.bytes
    : signData?.type === 'cell' ? signData.cell : undefined;

  const handleCopyData = useLastCallback(() => {
    copyTextToClipboard(blindData!);
    showNotification({ message: { key: 'WalletConnectDataCopied' } });
  });

  const accessKey = connectRequest?.items.some(({ name: itemName }) => itemName === 'ton_proof')
    ? 'WalletConnectProofAccess' : 'WalletConnectAppAccess';
  const previewNotice = preview && !preview.transaction && !signData
    ? lang(preview.isInvalid ? 'WalletConnectInvalid' : 'WalletConnectUnsupported') : undefined;

  const isManifestLoading = isLoading && !manifest && !hasManifestError;
  // The skeleton, the locked request and its preview replace each other with a fade
  const contentKey = isManifestLoading ? 0 : request && !preview ? 1 : 2;

  return (
    <WalletNoticeScreen
      sticker={isManifestLoading
        ? <Skeleton variant="round" animation="fast-wave" className={styles.iconSkeleton} />
        : <WalletAppIcon name={name} icon={manifest?.icon} isLarge />}
      title={isManifestLoading
        ? <Skeleton variant="rounded-rect" animation="fast-wave" className={styles.titleSkeleton} />
        : connectRequest ? lang('WalletConnectTitle')
          : signData ? lang('WalletConnectSignTitle', { name })
            : manifest ? lang('WalletConnectRequestTitle', { name }) : lang('WalletConnectRequest')}
      subtitle={isManifestLoading
        ? <Skeleton variant="rounded-rect" animation="fast-wave" className={styles.hostSkeleton} />
        : <AppHost url={manifest?.url} />}
      text={connectRequest ? lang(accessKey) : previewNotice}
      heroKey={isManifestLoading ? 0 : 1}
    >
      <Transition
        name="fade"
        activeKey={contentKey}
        shouldCleanup
        className={styles.content}
        slideClassName={styles.contentSlide}
      >
        {preview?.transaction?.messages.map((message, index) => {
          const amount = formatTonFromNanos(BigInt(message.amount));

          return (
            <Island key={index} className={styles.message}>
              <Control>
                <ControlLabel>{lang('GramAmountText', { amount }, { pluralValue: Number(amount) })}</ControlLabel>
                <ControlDescription className={styles.data}>{message.address}</ControlDescription>
              </Control>
              {message.comment !== undefined && (
                <Control>
                  <ControlLabel>{lang('WalletTransactionComment')}</ControlLabel>
                  <ControlDescription className={styles.comment}>{message.comment}</ControlDescription>
                </Control>
              )}
              {message.payload && message.comment === undefined && (
                <Control>
                  <ControlLabel>{lang('WalletConnectContractData')}</ControlLabel>
                  <ControlDescription className={styles.data}>{message.payload}</ControlDescription>
                </Control>
              )}
              {message.stateInit && (
                <Control>
                  <ControlLabel>{lang('WalletConnectStateInit')}</ControlLabel>
                  <ControlDescription className={styles.data}>{message.stateInit}</ControlDescription>
                </Control>
              )}
            </Island>
          );
        })}
        {signData?.type === 'text' && (
          <Island>
            <div className={styles.signText}>{signData.text}</div>
          </Island>
        )}
        {blindData && (
          <Island>
            <Interactive clickable ripple onClick={handleCopyData}>
              <Control>
                <ControlLabel>{lang('WalletConnectBinaryData')}</ControlLabel>
                <ControlDescription className={styles.data}>{blindData}</ControlDescription>
              </Control>
            </Interactive>
          </Island>
        )}
        {signData && (
          <IslandDescription className={buildClassName(styles.description, blindData && styles.dangerLabel)}>
            {lang(blindData ? 'WalletConnectBlindSign' : 'WalletConnectReviewSign')}
          </IslandDescription>
        )}
        {isSignMessage && (
          <IslandDescription className={buildClassName(styles.description, styles.dangerLabel)}>
            {lang('WalletConnectSignMessageNote')}
          </IslandDescription>
        )}
        {preview?.transaction && !isSignMessage && (
          <IslandDescription className={styles.description}>
            {preview.fee !== undefined
              ? lang(
                'WalletConnectFee',
                { amount: <ExpandableTonAmount nanos={preview.fee} withTicker /> },
                { withNodes: true },
              )
              : lang('WalletConnectFeeUnavailable')}
          </IslandDescription>
        )}
        {expires !== undefined && !isExpired && (
          <IslandDescription className={styles.description}>
            {lang('WalletConnectRemaining', { seconds: Math.max(0, expires - now) })}
          </IslandDescription>
        )}
        {errorKey && <div className={styles.error} role="alert">{lang(errorKey)}</div>}
        {isManifestLoading && <Spinner className={styles.spinner} />}
        <WalletNoticeActions>
          {request && !preview && !isExpired && (
            <Button pill isLoading={isLoading} disabled={isLoading} onClick={onUnlock}>
              {lang('WalletConnectUnlock')}
            </Button>
          )}
          {canConfirm && (
            <Button pill isLoading={isLoading && !isDeclining} disabled={isLoading} onClick={onConfirm}>
              {lang(connectRequest ? 'WalletConnect'
                : signData ? 'WalletConnectSignData' : isSignMessage ? 'WalletConnectSign' : 'GeneralConfirm')}
            </Button>
          )}
          {session && !isClosed && !isExpired && (
            <Button
              pill
              color="translucent"
              isLoading={isLoading && isDeclining}
              disabled={isLoading}
              onClick={onDecline}
            >
              {lang(connectRequest ? 'Cancel' : 'SuggestedPostDecline')}
            </Button>
          )}
        </WalletNoticeActions>
      </Transition>
    </WalletNoticeScreen>
  );
};

// The globe stands in for a verification badge, which the server does not report
export const AppHost = memo(({ url }: AppHostOwnProps) => {
  const host = getHost(url);
  if (!host) return undefined;

  return (
    <span className={styles.host}>
      <Icon name="web" className={styles.hostIcon} />
      {host}
    </span>
  );
});

export function getHost(url?: string) {
  try {
    return new URL(url!).hostname;
  } catch {
    return undefined;
  }
}

export default memo(WalletTonConnectScreen);
