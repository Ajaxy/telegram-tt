import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import Icon from '../../common/icons/Icon';

import styles from './PrivacyLockedOption.module.scss';

type OwnProps = {
  label: string;
  isChecked?: boolean;
};

function PrivacyLockedOption({ label, isChecked }: OwnProps) {
  const { showNotification } = getActions();

  const lang = useLang();

  return (
    <div
      className={buildClassName(
        styles.root,
        isChecked && styles.checked,
      )}
      onClick={() => showNotification({ message: lang('OptionPremiumRequiredMessage') })}
    >
      <span>{label}</span>
      <Icon name="lock-filled" className={styles.lockIcon} />
    </div>
  );
}

export default memo(PrivacyLockedOption);
