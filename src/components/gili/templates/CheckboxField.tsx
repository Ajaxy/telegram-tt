import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import Control, {
  ControlDescription,
  ControlLabel,
} from '../layout/Control';
import Interactive from '../layout/Interactive';
import Checkbox from '../primitives/Checkbox';

import styles from './CheckboxField.module.scss';

type Props = Omit<React.ComponentProps<typeof Checkbox>, 'className' | 'disabled'> & {
  label: string;
  description?: string;
  disabled?: boolean;
  loading?: boolean;
  isCentered?: boolean;
  className?: string;
  controlClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  ripple?: boolean;
};

const CheckboxField = ({
  label,
  description,
  disabled,
  loading,
  isCentered,
  className,
  controlClassName,
  labelClassName,
  descriptionClassName,
  ripple,
  ...checkboxProps
}: Props) => {
  return (
    <Interactive
      asLabel
      clickable
      ripple={ripple}
      disabled={disabled}
      loading={loading}
      className={buildClassName(className, isCentered && styles.centered)}
    >
      <Control className={buildClassName(controlClassName, isCentered && styles.centeredControl)}>
        <Checkbox {...checkboxProps} />
        <ControlLabel className={labelClassName}>{label}</ControlLabel>
        {description !== undefined ? (
          <ControlDescription className={descriptionClassName}>
            {description}
          </ControlDescription>
        ) : undefined}
      </Control>
    </Interactive>
  );
};

export default memo(CheckboxField);
