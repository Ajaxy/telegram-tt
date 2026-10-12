import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiOnrampProvider } from '../../../api/types';
import type { IconName } from '../../../types/icons';

import { selectWalletCurrency } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Control, { ControlDescription, ControlIcon, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island, { IslandTitle } from '@gili/layout/Island';

import styles from './WalletBuyScreen.module.scss';

type OwnProps = {
  onCurrencyClick: NoneToVoidFunction;
  onProviderSelect: (provider: string) => void;
};

type StateProps = {
  currency: string;
  providers?: ApiOnrampProvider[];
};

type ProviderRowOwnProps = {
  provider: ApiOnrampProvider;
  onSelect: (provider: string) => void;
};

type ProviderIcon = { icon: IconName; color: string };

const PROVIDER_ICONS: Record<string, ProviderIcon> = {
  walt: { icon: 'walt', color: '#2196f3' },
  wallet: { icon: 'walt', color: '#2196f3' },
  moonpay: { icon: 'card-alt', color: '#7d55f4' },
};

const DEFAULT_PROVIDER_ICON: ProviderIcon = { icon: 'card-alt', color: '#4caf50' };

// A transaction names its provider, not its id
export function getOnrampProviderIcon(providerId: string): ProviderIcon {
  return PROVIDER_ICONS[providerId.toLowerCase()] || DEFAULT_PROVIDER_ICON;
}

const WalletBuyScreen = ({ currency, providers, onCurrencyClick, onProviderSelect }: OwnProps & StateProps) => {
  const { loadOnrampProviders } = getActions();

  const lang = useLang();

  useEffect(loadOnrampProviders, [loadOnrampProviders]);

  return (
    <div className={styles.root}>
      <IslandTitle>{lang('WalletBuyPayWith')}</IslandTitle>
      <Island>
        <Interactive clickable ripple onClick={onCurrencyClick}>
          <Control>
            <ControlLabel>{lang('WalletBuyCurrency')}</ControlLabel>
            <ControlDescription>{currency}</ControlDescription>
          </Control>
        </Interactive>
      </Island>
      {providers && providers.length > 0 && (
        <>
          <IslandTitle>{lang('WalletBuyBuyWith')}</IslandTitle>
          <Island>
            {providers.map((provider) => (
              <WalletBuyProvider key={provider.id} provider={provider} onSelect={onProviderSelect} />
            ))}
          </Island>
        </>
      )}
    </div>
  );
};

const WalletBuyProvider = memo(({ provider, onSelect }: ProviderRowOwnProps) => {
  const { icon, color } = getOnrampProviderIcon(provider.id);

  const handleClick = useLastCallback(() => {
    onSelect(provider.id);
  });

  return (
    <Interactive clickable ripple onClick={handleClick}>
      <Control>
        <ControlIcon iconName={icon} backgroundColor={color} />
        <ControlLabel>{provider.name}</ControlLabel>
      </Control>
    </Interactive>
  );
});

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      currency: selectWalletCurrency(global),
      providers: global.wallet?.onrampProviders,
    };
  },
)(WalletBuyScreen));
