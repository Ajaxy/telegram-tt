import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import { selectAvailableCurrencies, selectWalletCurrency } from '../../../global/selectors';

import useSelector from '../../../hooks/data/useSelector';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Control, { ControlAfter, ControlDescription, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Island from '@gili/layout/Island';

import styles from './WalletCurrencyScreen.module.scss';

type OwnProps = {
  onSelect: NoneToVoidFunction;
};

type RowOwnProps = {
  value: string;
  isSelected: boolean;
  onSelect: NoneToVoidFunction;
};

const WalletCurrencyScreen = ({ onSelect }: OwnProps) => {
  const currency = useSelector(selectWalletCurrency);
  const currencies = useSelector(selectAvailableCurrencies);

  return (
    <div className={styles.root}>
      <Island>
        {currencies?.map((value) => (
          <WalletCurrencyRow
            key={value}
            value={value}
            isSelected={value === currency}
            onSelect={onSelect}
          />
        ))}
      </Island>
    </div>
  );
};

const WalletCurrencyRow = memo(({ value, isSelected, onSelect }: RowOwnProps) => {
  const { setWalletCurrency } = getActions();

  const lang = useLang();
  const name = lang.currency(value);

  const handleClick = useLastCallback(() => {
    setWalletCurrency({ currency: value });
    onSelect();
  });

  return (
    <Interactive clickable ripple onClick={handleClick}>
      <Control>
        <ControlLabel>{value}</ControlLabel>
        {name && name !== value && <ControlDescription>{name}</ControlDescription>}
        {isSelected && (
          <ControlAfter>
            <Icon name="check" className={styles.check} />
          </ControlAfter>
        )}
      </Control>
    </Interactive>
  );
});

export default memo(WalletCurrencyScreen);
