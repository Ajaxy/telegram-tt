import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';

import Icon from '../../common/Icon';

import styles from './PrivacyLockedOption.module.scss';

type OwnProps = {
  label: string;
};

function PrivacyLockedOption({ label }: OwnProps) {
  const lang = useLang();
  const { showNotification } = getActions();

  return (
    <div
      className={styles.contactsAndPremiumOptionTitle}
      onClick={() => showNotification({ message: lang('OptionPremiumRequiredMessage') })}
    >
      <span>{label}</span>
      <Icon name="lock-badge" className={styles.lockIcon} />
    </div>
  );
}

export default memo(PrivacyLockedOption);
