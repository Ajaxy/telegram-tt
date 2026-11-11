import {
  memo, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { ApiMessageActionGramTransfer } from '../../../api/types/messageActions';
import type { ApiTonConnectEmulatedActionType, ApiTonConnectTransaction } from '../../../api/types/wallet';
import type { TabState } from '../../../global/types';
import type { RegularLangKey } from '../../../types/language';

import { TON_CONNECT_MANIFEST_CONTENT_ERROR_CODE } from '../../../config';
import { getMainUsername, getUserFullName } from '../../../global/helpers';
import { WALLET_ERROR_LANG_KEYS } from '../../../global/helpers/wallet';
import { selectWalletCurrency, selectWalletCurrencyRate } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { formatTonInFiat } from '../../../util/formatCurrency';
import { formatTonTextFromNanos } from '../../../util/localization/format';
import { getServerTime } from '../../../util/serverTime';
import renderText from '../../common/helpers/renderText';

import useInterval from '../../../hooks/schedulers/useInterval';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import GramTransfer from '../../middle/message/actions/GramTransfer';
import Button from '../../ui/Button';
import Skeleton from '../../ui/placeholder/Skeleton';
import Spinner from '../../ui/Spinner';
import Transition from '../../ui/Transition';
import ExpandableTonAmount from './ExpandableTonAmount';
import WalletAppIcon from './WalletAppIcon';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';
import Control, { ControlDescription, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island, { IslandDescription, IslandTitle } from '@gili/layout/Island';

import styles from './WalletTonConnectScreen.module.scss';

type OwnProps = {
  flow?: TabState['walletTonConnect'];
  // The bot of a widget's call, which stands for the dApp
  bot?: ApiUser;
  // False while the window shields a widget's call from the tap that opened it
  isArmed: boolean;
  onUnlock: NoneToVoidFunction;
  onConfirm: NoneToVoidFunction;
  onDecline: NoneToVoidFunction;
};

type StateProps = {
  tonUsdRate?: number;
  currency: string;
  currencyRate?: number;
};

type AppHostOwnProps = {
  url?: string;
};

const CLOCK_INTERVAL = 1000;
const EMULATED_ACTION_KEYS: Record<ApiTonConnectEmulatedActionType, RegularLangKey> = {
  withdraw: 'WalletConnectActionWithdraw',
  deposit: 'WalletConnectActionDeposit',
  transfer: 'WalletConnectActionTransfer',
  excess: 'WalletConnectActionExcess',
  callContract: 'WalletConnectActionCallContract',
  deployContract: 'WalletConnectActionDeployContract',
  unknown: 'WalletConnectActionUnknown',
};
const DIGITS_REGEX = /^\d+$/;

const WalletTonConnectScreen = ({
  flow, bot, isArmed, tonUsdRate, currency, currencyRate, onUnlock, onConfirm, onDecline,
}: OwnProps & StateProps) => {
  const { showNotification } = getActions();

  const lang = useLang();

  const [now, setNow] = useState(getServerTime);
  const {
    session, connectRequest, request, preview, error, status, isDeclining, widget,
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
  // Only the bot of the message speaks for a widget, never anything the widget says about itself
  const name = (widget && getUserFullName(lang, bot)) || manifest?.name || lang('WalletConnectApp');
  const botUsername = bot && getMainUsername(bot);
  // A connection shows the host the manifest came from, since the manifest's own `url` is whatever the dApp wrote
  const appUrl = connectRequest?.manifestUrl ?? manifest?.url;
  const hasManifestError = Boolean(session?.manifestError);

  // Without the simulation the fee is unknown, and a failed one usually means the transfer would fail on the chain
  const isSimulated = Boolean(preview?.transaction && !preview.isInvalid && preview.fee !== undefined);

  // Neither signing data nor a signed message is simulated: the dApp relays the message later and pays the gas
  const signData = preview?.signData;
  const isSignMessage = preview?.request.method === 'signMessage';
  const canSignMessage = isSignMessage && Boolean(preview.transaction);
  const canUnlock = Boolean(request && !preview && !isExpired);
  // A widget's call shows its buttons while the preview loads, so the island keeps its size when it arrives
  const isPreviewLoading = Boolean(widget && isLoading && !preview);
  const canDecline = Boolean(session || widget) && !isClosed && !isExpired;
  const canConfirm = !isClosed && !isExpired && !hasManifestError
    && (Boolean(connectRequest && manifest) || isSimulated || Boolean(signData) || canSignMessage);
  const errorKey = session?.manifestError === TON_CONNECT_MANIFEST_CONTENT_ERROR_CODE ? 'WalletConnectManifestInvalid'
    : hasManifestError ? 'WalletConnectManifestError'
      : isClosed ? 'WalletConnectSessionClosed'
        : isExpired ? 'WalletConnectExpired' : error ? WALLET_ERROR_LANG_KEYS[error] : undefined;
  const blindData = signData?.type === 'binary' ? signData.bytes
    : signData?.type === 'cell' ? signData.cell : undefined;
  // A widget's call names its method before the preview does
  const isSignRequest = Boolean(signData) || widget?.call.method === 'signData';
  const transaction = preview?.transaction;
  // A widget's call carries its transaction, so the card shows while the preview estimates the fee
  const transfer = useMemo(() => {
    const shown = transaction
      ?? (widget?.call.method === 'sendTransaction' ? readCallTransaction(widget.call.params) : undefined);
    return shown && buildTransferCard(shown);
  }, [transaction, widget]);
  const recipientCount = transfer?.recipientCount ?? 0;
  // The card shows a lone plain transfer whole; batches and contract calls list each message, as the other apps do
  const hasDetails = transaction && (transaction.messages.length > 1
    || transaction.messages.some(({ payload, comment, stateInit }) => (payload && comment === undefined) || stateInit));
  const emulation = isSignMessage ? undefined : preview?.emulation;
  // The card shows a plain payment whole; anything else the transaction would do is listed, as the native apps do
  const hasEmulatedActions = emulation?.actions.some(({ type }) => type !== 'withdraw');
  const fiatFee = preview?.fee !== undefined
    ? formatTonInFiat(preview.fee, tonUsdRate, currency, currencyRate, lang.code, { isPrecise: true })
    : undefined;

  const handleCopyData = useLastCallback(() => {
    copyTextToClipboard(blindData!);
    showNotification({ message: { key: 'WalletConnectDataCopied' } });
  });

  const accessKey = connectRequest?.items.some(({ name: itemName }) => itemName === 'ton_proof')
    ? 'WalletConnectProofAccess' : 'WalletConnectAppAccess';
  const previewNotice = preview && !preview.transaction && !signData
    ? lang(preview.isInvalid ? 'WalletConnectInvalid' : 'WalletConnectUnsupported') : undefined;

  const isManifestLoading = isLoading && !manifest && !widget && !hasManifestError;
  // The skeleton, the locked request and its preview replace each other with a fade
  const contentKey = isManifestLoading ? 0 : request && !preview ? 1 : 2;

  return (
    <WalletNoticeScreen
      sticker={isManifestLoading
        ? <Skeleton variant="round" animation="fast-wave" className={styles.iconSkeleton} />
        : widget ? <Avatar peer={bot} size="jumbo" className={styles.botAvatar} />
          : <WalletAppIcon name={name} icon={manifest?.icon} isLarge />}
      title={isManifestLoading
        ? <Skeleton variant="rounded-rect" animation="fast-wave" className={styles.titleSkeleton} />
        : connectRequest ? lang('WalletConnectTitle')
          : isSignRequest ? lang('WalletConnectSignData')
            : transaction || widget ? lang('WalletConnectTransfer')
              : manifest ? lang('WalletConnectRequestTitle', { name }, { withNodes: true })
                : lang('WalletConnectRequest')}
      subtitle={isManifestLoading
        ? <Skeleton variant="rounded-rect" animation="fast-wave" className={styles.hostSkeleton} />
        : connectRequest ? <AppHost url={appUrl} />
          : (
            // Who asks: the bot with its username, or the app with the host its manifest came from
            <span className={styles.requester}>
              {(widget || manifest) && <span className={styles.requesterName}>{name}</span>}
              {widget
                ? botUsername && <span className={styles.username}>{`@${botUsername}`}</span>
                : <AppHost url={appUrl} />}
            </span>
          )}
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
        {transfer && (
          <GramTransfer
            action={transfer.action}
            peerName={recipientCount > 1
              ? lang('WalletConnectRecipients', { count: recipientCount }, { pluralValue: recipientCount })
              : undefined}
            isOutgoing
            isRequest
          />
        )}
        {hasDetails && transaction.messages.map((message, index) => {
          return (
            <Island key={index} className={styles.message}>
              <Control>
                <ControlLabel>{formatTonTextFromNanos(lang, BigInt(message.amount))}</ControlLabel>
                <ControlDescription className={styles.data}>{message.address}</ControlDescription>
              </Control>
              {message.comment !== undefined && (
                <Control>
                  <ControlLabel>{lang('WalletTransactionComment')}</ControlLabel>
                  <ControlDescription className={styles.comment}>{renderText(message.comment)}</ControlDescription>
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
        {hasEmulatedActions && (
          <>
            <IslandTitle className={styles.dataTitle}>{lang('WalletConnectPreview')}</IslandTitle>
            <Island className={styles.message}>
              {emulation!.actions.map(({ type, amount, address }, index) => (
                <Control key={index}>
                  <ControlLabel>
                    {lang(EMULATED_ACTION_KEYS[type])}
                    {amount && ` · ${formatTonTextFromNanos(lang, BigInt(amount))}`}
                  </ControlLabel>
                  {address && <ControlDescription className={styles.data}>{address}</ControlDescription>}
                </Control>
              ))}
            </Island>
          </>
        )}
        {(emulation?.isFailed || emulation?.isIncomplete) && (
          <IslandDescription className={buildClassName(styles.description, styles.dangerLabel)}>
            {lang(emulation.isFailed ? 'WalletConnectEmulationFailed' : 'WalletConnectEmulationIncomplete')}
          </IslandDescription>
        )}
        {signData && <IslandTitle className={styles.dataTitle}>{lang('WalletConnectData')}</IslandTitle>}
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
        {transfer && !isSignMessage && (
          <IslandDescription className={styles.description}>
            {preview?.fee !== undefined
              ? lang('WalletConnectFee', {
                amount: (
                  <>
                    <ExpandableTonAmount nanos={preview.fee} withTicker />
                    {fiatFee && ` (~${fiatFee})`}
                  </>
                ),
              }, { withNodes: true })
              : lang(transaction ? 'WalletConnectFeeUnavailable' : 'WalletConnectFeeEstimating')}
          </IslandDescription>
        )}
        {errorKey && <div className={styles.error} role="alert">{lang(errorKey)}</div>}
        {(isManifestLoading || (isPreviewLoading && !transfer)) && <Spinner className={styles.spinner} />}
        {(canUnlock || canConfirm || isPreviewLoading || canDecline) && (
          <WalletNoticeActions>
            <Island className={styles.actions}>
              {canUnlock && (
                <Button pill isLoading={isLoading} disabled={isLoading} onClick={onUnlock}>
                  {lang('WalletConnectUnlock')}
                </Button>
              )}
              {(canConfirm || isPreviewLoading) && (
                <Button
                  pill
                  isLoading={isLoading && !isDeclining && !isPreviewLoading}
                  disabled={isLoading || !isArmed}
                  onClick={onConfirm}
                >
                  {lang(connectRequest ? 'WalletConnect'
                    : isSignRequest ? 'WalletConnectSignData' : isSignMessage ? 'WalletConnectSign' : 'GeneralConfirm')}
                </Button>
              )}
              {canDecline && (
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
            </Island>
          </WalletNoticeActions>
        )}
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

// The card shows the whole batch: its total, and its recipient or how many there are
function buildTransferCard({ messages }: ApiTonConnectTransaction) {
  const action: ApiMessageActionGramTransfer = {
    mediaType: 'action',
    type: 'gramTransfer',
    amount: messages.reduce((sum, { amount }) => sum + BigInt(amount), 0n),
    peerAddress: messages[0].address,
    transactionId: '',
    comment: messages.length === 1 ? messages[0].comment : undefined,
  };

  return { action, recipientCount: new Set(messages.map(({ address }) => address)).size };
}

// The call as the widget made it, which the framework checked for shape: its messages, without their comments yet
function readCallTransaction(params: object): ApiTonConnectTransaction | undefined {
  const { messages } = params as { messages?: { address?: unknown; amount?: unknown }[] };
  if (!Array.isArray(messages) || !messages.length) return undefined;

  const isValid = messages.every((message) => (
    typeof message?.address === 'string' && typeof message.amount === 'string' && DIGITS_REGEX.test(message.amount)
  ));
  return isValid ? { messages: messages as ApiTonConnectTransaction['messages'] } : undefined;
}

export function getHost(url?: string) {
  try {
    return new URL(url!).hostname;
  } catch {
    return undefined;
  }
}

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => ({
  tonUsdRate: global.appConfig.tonUsdRate,
  currency: selectWalletCurrency(global),
  currencyRate: selectWalletCurrencyRate(global),
}))(WalletTonConnectScreen));
