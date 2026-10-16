import { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { selectWalletCurrency, selectWalletCurrencyRate } from '../../../global/selectors';
import { formatTonInFiat } from '../../../util/formatCurrency';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import ExpandableTonAmount from './ExpandableTonAmount';
import WalletNoticeScreen, { WalletNoticeActions } from './WalletNoticeScreen';
import Island from '@gili/layout/Island';
import CheckboxField from '@gili/templates/CheckboxField';

import styles from './WalletDisableBackupScreen.module.scss';

type OwnProps = {
  isLoading?: boolean;
  onConfirm: (shouldRotateKey: boolean) => void;
};

type StateProps = {
  // Nanotons
  keyRotationFee?: bigint;
  currency: string;
  tonUsdRate?: number;
  currencyRate?: number;
};

const WalletDisableBackupScreen = ({
  isLoading, keyRotationFee, currency, tonUsdRate, currencyRate, onConfirm,
}: OwnProps & StateProps) => {
  const { loadWalletKeyRotationFee } = getActions();

  const lang = useLang();

  const [shouldRotateKey, setShouldRotateKey] = useState(false);

  useEffect(() => {
    loadWalletKeyRotationFee();
  }, []);

  const handleConfirm = useLastCallback(() => onConfirm(shouldRotateKey));

  const fiatFee = keyRotationFee !== undefined
    ? formatTonInFiat(keyRotationFee, tonUsdRate, currency, currencyRate, lang.code)
    : undefined;

  return (
    <WalletNoticeScreen
      sticker="⚠️"
      title={lang('WalletDisableBackupTitle')}
      text={lang(shouldRotateKey ? 'WalletDisableBackupRotateText' : 'WalletDisableBackupText')}
    >
      <Island>
        <CheckboxField label={lang('WalletUpdatePhrase')} checked={shouldRotateKey} onChange={setShouldRotateKey} />
      </Island>
      {shouldRotateKey && (
        <div className={styles.hint}>
          <div>{lang('WalletUpdatePhraseHint')}</div>
          {keyRotationFee !== undefined && (
            <div>
              {lang('WalletDisableBackupFee', {
                amount: <ExpandableTonAmount nanos={keyRotationFee} />,
                fiat: fiatFee ? ` (~${fiatFee})` : '',
              }, { withNodes: true })}
            </div>
          )}
        </div>
      )}
      <WalletNoticeActions>
        <Button color="danger" pill disabled={isLoading} isLoading={isLoading} onClick={handleConfirm}>
          {lang('WalletDisableBackupConfirm')}
        </Button>
      </WalletNoticeActions>
    </WalletNoticeScreen>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      keyRotationFee: global.wallet?.keyRotationFee,
      currency: selectWalletCurrency(global),
      tonUsdRate: global.appConfig.tonUsdRate,
      currencyRate: selectWalletCurrencyRate(global),
    };
  },
)(WalletDisableBackupScreen));
