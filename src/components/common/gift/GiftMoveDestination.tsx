import { memo } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';
import type { RegularLangKey } from '../../../types/language';

import useLang from '../../../hooks/useLang';

import Icon from '../icons/Icon';

import styles from './GiftMoveDestination.module.scss';

export type GiftMoveDestinationStep = {
  icon: IconName;
  labelKey?: RegularLangKey;
};

type OwnProps = {
  path: GiftMoveDestinationStep[];
};

const GiftMoveDestination = ({ path }: OwnProps) => {
  const lang = useLang();

  return (
    <div className={styles.root}>
      <div>{lang('GiftMoveAppear')}</div>
      <div className={styles.path}>
        {path.map(({ icon, labelKey }, index) => (
          <span key={icon} className={styles.step}>
            {Boolean(index) && <Icon name="next" className={styles.arrow} />}
            <Icon name={icon} className={styles.icon} />
            {labelKey && lang(labelKey)}
          </span>
        ))}
      </div>
    </div>
  );
};

export default memo(GiftMoveDestination);
