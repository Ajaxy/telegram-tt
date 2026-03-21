import type { TeactNode } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import buildClassName from '../../../util/buildClassName';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import styles from './PhoneCallButton.module.scss';

type OwnProps = {
  label: string;
  icon?: IconName;
  iconClassName?: string;
  customIcon?: TeactNode;
  className?: string;
  isDisabled?: boolean;
  isActive?: boolean;
  onClick: VoidFunction;
};

const PhoneCallButton = ({
  label,
  customIcon,
  icon,
  iconClassName,
  className,
  isDisabled,
  isActive,
  onClick,
}: OwnProps) => {
  return (
    <div className={styles.root}>
      <Button
        round
        className={buildClassName(className, styles.button, isActive && styles.active)}
        onClick={onClick}
        disabled={isDisabled}
      >
        {customIcon || <Icon name={icon!} className={iconClassName} />}
      </Button>
      <div className={styles.buttonText}>{label}</div>
    </div>
  );
};

export default memo(PhoneCallButton);
