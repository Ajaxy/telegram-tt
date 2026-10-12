import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiTonConnectSession } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { WALLET_ERROR_LANG_KEYS } from '../../../global/helpers/wallet';
import { selectTabState } from '../../../global/selectors';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import Spinner from '../../ui/Spinner';
import Transition from '../../ui/Transition';
import WalletAppIcon from './WalletAppIcon';
import WalletNoticeScreen from './WalletNoticeScreen';
import { getHost } from './WalletTonConnectScreen';
import Control, {
  ControlBefore, ControlDescription, ControlIcon, ControlLabel,
} from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island, { IslandDescription, IslandTitle } from '@gili/layout/Island';

import styles from './WalletTonConnectScreen.module.scss';

type OwnProps = {
  onOpen: (session: ApiTonConnectSession) => void;
  onDisconnectAll: NoneToVoidFunction;
};

type StateProps = {
  sessions?: ApiTonConnectSession[];
  hasError?: boolean;
  flow?: TabState['walletTonConnect'];
};

type SessionRowOwnProps = {
  session: ApiTonConnectSession;
  onClick: (session: ApiTonConnectSession) => void;
};

enum ContentKey {
  Loading,
  List,
  Empty,
}

const WalletConnectedAppsScreen = ({
  sessions, hasError, flow, onOpen, onDisconnectAll,
}: OwnProps & StateProps) => {
  const { loadWalletTonConnectSessions } = getActions();

  const lang = useLang();

  const [isDisconnectAllOpen, openDisconnectAll, closeDisconnectAll] = useFlag();

  useEffect(() => {
    loadWalletTonConnectSessions();
  }, []);

  const handleRetry = useLastCallback(() => {
    loadWalletTonConnectSessions();
  });

  const handleDisconnectAll = useLastCallback(() => {
    closeDisconnectAll();
    onDisconnectAll();
  });

  const activeSessions = sessions?.filter(({ isClosed, isPending }) => !isClosed && !isPending);
  const isBusy = flow?.status === 'pending';

  // A refresh, such as the one after a disconnect, keeps the current content on screen
  const isUnknown = !sessions && !hasError;
  const isEmpty = Boolean(sessions) && !hasError && !activeSessions!.length;
  const contentKey = isUnknown ? ContentKey.Loading : isEmpty ? ContentKey.Empty : ContentKey.List;

  function renderContent() {
    if (isUnknown) {
      return (
        <div className={styles.loading}>
          <Spinner />
        </div>
      );
    }

    if (isEmpty) {
      return <WalletNoticeScreen sticker="🔗" title={lang('WalletConnectEmpty')} text={lang('WalletConnectAccess')} />;
    }

    return renderList();
  }

  function renderList() {
    return (
      <div className={styles.root}>
        <IslandTitle>{lang('WalletConnectActive')}</IslandTitle>
        {hasError && (
          <Button pill onClick={handleRetry}>{lang('WalletConnectRetry')}</Button>
        )}
        {Boolean(activeSessions?.length) && (
          <Island>
            <Interactive clickable ripple disabled={isBusy} onClick={openDisconnectAll}>
              <Control>
                <ControlIcon iconName="hand-stop" backgroundColor="var(--color-error)" />
                <ControlLabel className={styles.dangerLabel}>{lang('WalletDisconnectAll')}</ControlLabel>
              </Control>
            </Interactive>
            {activeSessions.map((session) => (
              <SessionRow key={session.id} session={session} onClick={onOpen} />
            ))}
          </Island>
        )}
        <IslandDescription>{lang('WalletConnectAccess')}</IslandDescription>
        {flow?.error && <div className={styles.error} role="alert">{lang(WALLET_ERROR_LANG_KEYS[flow.error])}</div>}
        <ConfirmDialog
          isOpen={isDisconnectAllOpen}
          title={lang('WalletDisconnectAllTitle')}
          text={lang('WalletDisconnectAllText')}
          confirmLabel={lang('WalletDisconnectAllConfirm')}
          confirmIsDestructive
          confirmHandler={handleDisconnectAll}
          onClose={closeDisconnectAll}
        />
      </div>
    );
  }

  return (
    <Transition name="fade" activeKey={contentKey} shouldCleanup className={styles.stateTransition}>
      {renderContent()}
    </Transition>
  );
};

const SessionRow = memo(({ session, onClick }: SessionRowOwnProps) => {
  const lang = useLang();

  const handleClick = useLastCallback(() => onClick(session));

  const name = session.manifest?.name || lang('WalletConnectApp');

  return (
    <Interactive clickable ripple onClick={handleClick}>
      <Control>
        <ControlBefore>
          <WalletAppIcon name={name} icon={session.manifest?.icon} />
        </ControlBefore>
        <ControlLabel>{name}</ControlLabel>
        <ControlDescription>{getHost(session.manifest?.url)}</ControlDescription>
      </Control>
    </Interactive>
  );
});

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => ({
  sessions: global.wallet?.tonConnectSessions,
  hasError: global.wallet?.hasTonConnectSessionsError,
  flow: selectTabState(global).walletTonConnect,
}))(WalletConnectedAppsScreen));
