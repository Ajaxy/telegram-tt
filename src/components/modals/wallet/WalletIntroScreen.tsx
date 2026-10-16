import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { IconName } from '../../../types/icons';
import type { RegularLangKey } from '../../../types/language';

import { USD_CURRENCY_CODE } from '../../../config';
import { formatTonInFiat } from '../../../util/formatCurrency';

import useLang from '../../../hooks/useLang';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import ParticlesHeader from '../common/ParticlesHeader';
import Control, { ControlBefore, ControlDescription, ControlLabel } from '@gili/layout/Control';

import styles from './WalletIntroScreen.module.scss';

type OwnProps = {
  onDone: NoneToVoidFunction;
};

type StateProps = {
  tonUsdRate?: number;
};

// `formatTonInFiat` takes the rate against USD, which is 1 for USD itself
const USD_RATE = 1;
const ONE_GRAM_NANOS = 1_000_000_000n;

const TIPS: [IconName, RegularLangKey, RegularLangKey][] = [
  ['send', 'WalletIntroSendTitle', 'WalletIntroSendText'],
  ['trade', 'WalletIntroTradeTitle', 'WalletIntroTradeText'],
  ['gram', 'WalletIntroStoreTitle', 'WalletIntroStoreText'],
];

const WalletIntroScreen = ({ tonUsdRate, onDone }: OwnProps & StateProps) => {
  const lang = useLang();

  const hasRate = tonUsdRate !== undefined && Number.isFinite(tonUsdRate) && tonUsdRate > 0;
  const rate = hasRate
    ? formatTonInFiat(ONE_GRAM_NANOS, tonUsdRate, USD_CURRENCY_CODE, USD_RATE, lang.code)
    : undefined;
  const description = (
    <>
      {rate && <div>{lang('WalletIntroRate', { rate })}</div>}
      <div>{lang('WalletIntroYouCan')}</div>
    </>
  );

  return (
    <div className={styles.root}>
      <ParticlesHeader
        model="diamond-3d"
        color="blue"
        title={lang('WalletIntroTitle')}
        description={description}
        className={styles.header}
      />
      <div className={styles.tips}>
        {TIPS.map(([icon, titleKey, textKey]) => (
          <Control key={titleKey} className={styles.tip}>
            <ControlBefore className={styles.tipIcon}>
              <Icon name={icon} />
            </ControlBefore>
            <ControlLabel>{lang(titleKey)}</ControlLabel>
            <ControlDescription>
              {lang(textKey, undefined, { withNodes: true, renderTextFilters: ['br'] })}
            </ControlDescription>
          </Control>
        ))}
      </div>
      <Button className={styles.button} pill onClick={onDone}>{lang('WalletHowItWorksDone')}</Button>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      tonUsdRate: global.appConfig.tonUsdRate,
    };
  },
)(WalletIntroScreen));
