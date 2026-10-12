import { memo, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiMessageActionWalletTonConnectRequest } from '../../../../api/types/messageActions';

import { selectWalletTonConnectSessions } from '../../../../global/selectors';
import { getServerTime } from '../../../../util/serverTime';

import useSelector from '../../../../hooks/data/useSelector';
import useTimeout from '../../../../hooks/schedulers/useTimeout';
import useForceUpdate from '../../../../hooks/useForceUpdate';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import WalletAppIcon from '../../../modals/wallet/WalletAppIcon';

import styles from './WalletTonConnectRequest.module.scss';

type OwnProps = {
  action: ApiMessageActionWalletTonConnectRequest;
  messageId: number;
};

const SECONDS_IN_MINUTE = 60;
const MS_IN_SECOND = 1000;

// Only a pending card keeps a timer, so the cards in a long chat do not each tick
const WalletTonConnectRequest = ({ action, messageId }: OwnProps) => {
  const { openWalletTonConnectRequest, loadWalletTonConnectSessions } = getActions();

  const lang = useLang();

  const appName = action.dappName;

  // The message carries only the app's name; its icon comes with the session
  const sessions = useSelector(selectWalletTonConnectSessions);
  const session = useMemo(() => sessions?.find(({ id }) => id === action.sessionId), [sessions, action.sessionId]);
  const areSessionsLoaded = Boolean(sessions);

  useEffect(() => {
    if (!areSessionsLoaded) loadWalletTonConnectSessions();
  }, [areSessionsLoaded]);

  const remainingSeconds = action.expires - getServerTime();
  const remainingMinutes = Math.ceil(remainingSeconds / SECONDS_IN_MINUTE);
  const isExpired = remainingMinutes <= 0;
  const isDisabled = action.isAccepted || action.isDeclined || isExpired;

  // The card wakes at the next minute mark and at the deadline
  const forceUpdate = useForceUpdate();
  const nextTickSeconds = remainingSeconds % SECONDS_IN_MINUTE || SECONDS_IN_MINUTE;
  useTimeout(forceUpdate, isDisabled ? undefined : nextTickSeconds * MS_IN_SECOND);

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    openWalletTonConnectRequest({ sessionId: action.sessionId, messageId });
  });

  const statusKey = action.isAccepted ? 'WalletConnectConfirmed'
    : action.isDeclined ? 'WalletConnectDeclined' : isExpired ? 'WalletConnectExpired' : undefined;
  const appRequestKey = action.isAccepted ? 'WalletConnectRequestAppProcessed'
    : action.isDeclined ? 'WalletConnectRequestAppDeclined'
      : isExpired ? 'WalletConnectRequestAppExpired' : 'WalletConnectRequestAppPending';

  return (
    <button type="button" className={styles.root} disabled={isDisabled} onClick={handleClick}>
      <WalletAppIcon name={appName} icon={session?.manifest?.icon} />
      <span className={styles.title}>{appName || lang('WalletConnectApp')}</span>
      <span className={styles.status}>
        {appName
          ? lang(appRequestKey, { name: appName })
          : lang(action.topic === 'sendTransaction' ? 'WalletConnectTransfer' : 'WalletConnectRequest')}
      </span>
      {(!statusKey || !appName) && (
        <span className={styles.status}>
          {statusKey
            ? lang(statusKey)
            : lang('WalletConnectExpiresIn', { count: remainingMinutes }, { pluralValue: remainingMinutes })}
        </span>
      )}
    </button>
  );
};

export default memo(WalletTonConnectRequest);
