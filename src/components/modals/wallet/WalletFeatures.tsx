import { memo } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';
import type { RegularLangKey } from '../../../types/language';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import Icon from '../../common/icons/Icon';
import SafeLink from '../../common/SafeLink';
import Control, { ControlBefore, ControlDescription, ControlLabel } from '@gili/layout/Control';

import styles from './WalletFeatures.module.scss';

type OwnProps = {
  className?: string;
};

const TERMS_URL = 'https://telegram.org/tos';

const FEATURES: [IconName, RegularLangKey, RegularLangKey][] = [
  ['bolt', 'WalletFeatureInstantTitle', 'WalletFeatureInstantText'],
  ['no-fees', 'WalletFeatureNoFeesTitle', 'WalletFeatureNoFeesText'],
  ['blockchain-verified', 'WalletFeatureVerifiedTitle', 'WalletFeatureVerifiedText'],
];

const WalletFeatures = ({ className }: OwnProps) => {
  const lang = useLang();

  return (
    <div className={buildClassName(styles.root, className)}>
      {FEATURES.map(([icon, titleKey, textKey]) => (
        <Control key={titleKey} className={styles.feature}>
          <ControlBefore className={styles.featureIcon}>
            <Icon name={icon} />
          </ControlBefore>
          <ControlLabel>{lang(titleKey)}</ControlLabel>
          <ControlDescription>{lang(textKey)}</ControlDescription>
        </Control>
      ))}
      <div className={styles.terms}>
        {lang('WalletTermsNotice', {
          link: <SafeLink url={TERMS_URL} text={lang('WalletTermsLink')} />,
        }, { withNodes: true })}
      </div>
    </div>
  );
};

export default memo(WalletFeatures);
