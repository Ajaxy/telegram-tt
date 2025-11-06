import { memo } from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import Spinner from '../ui/Spinner';
import Transition from '../ui/Transition';
import Icon from './icons/Icon';

import styles from './IconWithSpinner.module.scss';

type OwnProps = {
  iconName: IconName;
  isLoading?: boolean;
};

const IconWithSpinner = ({ iconName, isLoading }: OwnProps) => {
  return (
    <Transition className={styles.root} activeKey={isLoading ? 0 : 1} name="fade">
      {isLoading ? (
        <Spinner className={styles.spinner} color="white" />
      ) : (
        <Icon className={styles.icon} name={iconName} />
      )}
    </Transition>
  );
};

export default memo(IconWithSpinner);
