import { memo } from '../../../lib/teact/teact';

import { selectWalletCurrency } from '../../../global/selectors';

import useSelector from '../../../hooks/data/useSelector';
import useLang from '../../../hooks/useLang';

import WalletKeySection from './WalletKeySection';
import Control, { ControlDescription, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island from '@gili/layout/Island';

import styles from './WalletSettingsScreen.module.scss';

type OwnProps = {
  onCurrencyClick: NoneToVoidFunction;
  onConnectedAppsClick: NoneToVoidFunction;
  onPasscodeClick: NoneToVoidFunction;
  onHowItWorksClick: NoneToVoidFunction;
  onShowPhrase: NoneToVoidFunction;
  onEnableBackup: NoneToVoidFunction;
  onDisableBackup: NoneToVoidFunction;
  onDeleteWallet: NoneToVoidFunction;
  onImportSavedWallet: (address: string) => void;
  onShowSavedPhrase: (address: string) => void;
  onEnterOwnPhrase: NoneToVoidFunction;
};

const WalletSettingsScreen = ({
  onCurrencyClick, onPasscodeClick, onHowItWorksClick, onShowPhrase, onEnableBackup, onDisableBackup,
  onDeleteWallet, onImportSavedWallet, onShowSavedPhrase, onEnterOwnPhrase, onConnectedAppsClick,
}: OwnProps) => {
  const lang = useLang();

  const currency = useSelector(selectWalletCurrency);

  return (
    <div className={styles.root}>
      <Island>
        <Interactive clickable ripple onClick={onConnectedAppsClick}>
          <Control>
            <ControlLabel>{lang('WalletConnectedApps')}</ControlLabel>
          </Control>
        </Interactive>
        <Interactive clickable ripple onClick={onCurrencyClick}>
          <Control>
            <ControlLabel>{lang('WalletBuyCurrency')}</ControlLabel>
            <ControlDescription>{currency}</ControlDescription>
          </Control>
        </Interactive>
        <Interactive clickable ripple onClick={onPasscodeClick}>
          <Control>
            <ControlLabel>{lang('Passcode')}</ControlLabel>
          </Control>
        </Interactive>
        <Interactive clickable ripple onClick={onHowItWorksClick}>
          <Control>
            <ControlLabel>{lang('WalletWhatIsWallet')}</ControlLabel>
          </Control>
        </Interactive>
      </Island>
      <WalletKeySection
        onShowPhrase={onShowPhrase}
        onEnableBackup={onEnableBackup}
        onDisableBackup={onDisableBackup}
        onDeleteWallet={onDeleteWallet}
        onImportSavedWallet={onImportSavedWallet}
        onShowSavedPhrase={onShowSavedPhrase}
        onEnterOwnPhrase={onEnterOwnPhrase}
      />
    </div>
  );
};

export default memo(WalletSettingsScreen);
