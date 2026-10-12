import { memo } from '../../../lib/teact/teact';

import type { ApiTonConnectSession } from '../../../api/types';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import WalletAppIcon from './WalletAppIcon';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';
import { AppHost } from './WalletTonConnectScreen';

import styles from './WalletTonConnectScreen.module.scss';

type OwnProps = {
  session: ApiTonConnectSession;
  isBusy?: boolean;
  error?: string;
  onDisconnect: (sessionId: string) => void;
};

const WalletConnectedAppScreen = ({
  session, isBusy, error, onDisconnect,
}: OwnProps) => {
  const lang = useLang();

  const name = session.manifest?.name || lang('WalletConnectApp');

  const handleDisconnect = useLastCallback(() => onDisconnect(session.id));

  return (
    <WalletNoticeScreen
      sticker={<WalletAppIcon name={name} icon={session.manifest?.icon} isLarge />}
      title={name}
      subtitle={<AppHost url={session.manifest?.url} />}
      text={lang('WalletConnectAppAccess')}
    >
      {error && <div className={styles.error} role="alert">{error}</div>}
      <WalletNoticeActions>
        <Button pill color="danger" isLoading={isBusy} disabled={isBusy} onClick={handleDisconnect}>
          {lang('WalletDisconnect')}
        </Button>
      </WalletNoticeActions>
    </WalletNoticeScreen>
  );
};

export default memo(WalletConnectedAppScreen);
