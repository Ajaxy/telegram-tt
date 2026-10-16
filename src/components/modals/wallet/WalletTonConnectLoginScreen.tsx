import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { WALLET_ERROR_LANG_KEYS } from '../../../global/helpers/wallet';
import { selectUser, selectWalletAddress } from '../../../global/selectors';
import { formatTonTextFromNanos } from '../../../util/localization/format';
import { shortenAddress } from '../../../util/tonAddress';

import useLang from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';
import Button from '../../ui/Button';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';
import { AppHost } from './WalletTonConnectScreen';
import Control, { ControlDescription, ControlLabel } from '@gili/layout/Control';
import Island, { IslandDescription } from '@gili/layout/Island';

import styles from './WalletTonConnectLoginScreen.module.scss';

type OwnProps = {
  flow: NonNullable<TabState['walletTonConnect']>;
  onConfirm: NoneToVoidFunction;
  onDecline: NoneToVoidFunction;
};

type StateProps = {
  bot?: ApiUser;
  address?: string;
  balance?: bigint;
};

const AVATAR_SIZE = 76;

const WalletTonConnectLoginScreen = ({
  flow, bot, address, balance, onConfirm, onDecline,
}: OwnProps & StateProps) => {
  const lang = useLang();

  const { oauth, status, error } = flow;
  const isLoading = status === 'pending';
  const botName = bot ? getUserFullName(lang, bot) : undefined;

  return (
    <WalletNoticeScreen
      sticker={<Avatar peer={bot} size={AVATAR_SIZE} className={styles.avatar} />}
      title={lang('WalletConnectToApp', { name: botName || oauth!.domain })}
      subtitle={<AppHost url={`https://${oauth!.domain}`} />}
      text={lang('WalletConnectProofAccess')}
    >
      {address && (
        <Island>
          <Control>
            <ControlLabel>{shortenAddress(address)}</ControlLabel>
            {balance !== undefined && (
              <ControlDescription>
                {lang('WalletSendBalance', { amount: formatTonTextFromNanos(lang, balance) })}
              </ControlDescription>
            )}
          </Control>
        </Island>
      )}
      <IslandDescription className={styles.description}>{lang('WalletConnectPermissionInfo')}</IslandDescription>
      {error && <div className={styles.error} role="alert">{lang(WALLET_ERROR_LANG_KEYS[error])}</div>}
      <WalletNoticeActions>
        <Button pill isLoading={isLoading} disabled={isLoading || !address} onClick={onConfirm}>
          {lang('WalletConnect')}
        </Button>
        <Button pill color="translucent" disabled={isLoading} onClick={onDecline}>
          {lang('Cancel')}
        </Button>
      </WalletNoticeActions>
    </WalletNoticeScreen>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { flow }): Complete<StateProps> => ({
    bot: flow.oauth ? selectUser(global, flow.oauth.botId) : undefined,
    address: selectWalletAddress(global),
    balance: global.wallet?.state?.balance,
  }),
)(WalletTonConnectLoginScreen));
