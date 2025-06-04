import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import buildClassName from '../../../util/buildClassName';

import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';

import styles from './PrivacyLockedOption.module.scss';

type OwnProps = {
  label: string;
  isChecked?: boolean;
};

function PrivacyLockedOption({ label, isChecked }: OwnProps) {
  const lang = useOldLang();
  const { showNotification } = getActions();

  return (
    <div
      className={buildClassName(
        styles.root,
        isChecked && styles.checked,
      )}
      onClick={() => showNotification({ message: lang('OptionPremiumRequiredMessage') })}
    >
      <span>{label}</span>
      <Icon name="lock-badge" className={styles.lockIcon} />
    </div>
  );
}

export default memo(PrivacyLockedOption);
