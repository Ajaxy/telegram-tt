import { memo } from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import ParticlesHeader from '../common/ParticlesHeader';
import WalletFeatures from './WalletFeatures';

import styles from './WalletHowItWorksScreen.module.scss';

type OwnProps = {
  onDone: NoneToVoidFunction;
};

const WalletHowItWorksScreen = ({ onDone }: OwnProps) => {
  const lang = useLang();

  return (
    <div className={styles.root}>
      <ParticlesHeader
        model="diamond-3d"
        color="blue"
        title={lang('WalletHowItWorksTitle')}
        description={lang('WalletHowItWorksSubtitle')}
        className={styles.header}
      />
      <WalletFeatures className={styles.features} />
      <Button className={styles.button} pill onClick={onDone}>{lang('WalletHowItWorksDone')}</Button>
    </div>
  );
};

export default memo(WalletHowItWorksScreen);
