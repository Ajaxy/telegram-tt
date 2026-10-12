import { memo } from '../../../lib/teact/teact';

import { shortenAddress } from '../../../util/tonAddress';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';

type OwnProps = {
  canSave?: boolean;
  switchToAddress?: string;
  onConfirm: (shouldSaveCurrent: boolean) => void;
};

const WalletDeleteScreen = ({ canSave, switchToAddress, onConfirm }: OwnProps) => {
  const lang = useLang();

  const handleSave = useLastCallback(() => onConfirm(true));
  const handleDelete = useLastCallback(() => onConfirm(false));

  const isSwitch = Boolean(switchToAddress);

  return (
    <WalletNoticeScreen
      sticker={isSwitch ? '🔁' : '⚠️'}
      title={lang(isSwitch ? 'WalletSwitchTitle' : 'WalletDeleteTitle')}
      text={isSwitch
        ? lang('WalletSwitchText', { address: shortenAddress(switchToAddress) })
        : lang('WalletDeleteText')}
    >
      <WalletNoticeActions>
        {canSave ? (
          <>
            <Button pill onClick={handleSave}>
              {lang(isSwitch ? 'WalletSwitchKeep' : 'WalletDeleteSave')}
            </Button>
            <Button color="danger" isText pill onClick={handleDelete}>
              {lang(isSwitch ? 'WalletSwitchAnyway' : 'WalletDeleteAnyway')}
            </Button>
          </>
        ) : (
          <Button color="danger" pill onClick={handleDelete}>
            {lang(isSwitch ? 'WalletSwitchConfirm' : 'WalletDeleteWallet')}
          </Button>
        )}
      </WalletNoticeActions>
    </WalletNoticeScreen>
  );
};

export default memo(WalletDeleteScreen);
