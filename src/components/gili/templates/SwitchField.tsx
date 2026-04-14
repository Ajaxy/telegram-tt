import { memo } from '../../../lib/teact/teact';

import Control, {
  ControlDescription,
  ControlLabel,
} from '../layout/Control';
import Interactive from '../layout/Interactive';
import Switch from '../primitives/Switch';

type Props = Omit<React.ComponentProps<typeof Switch>, 'className' | 'disabled'> & {
  label: string;
  description?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  controlClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  ripple?: boolean;
};

const SwitchField = ({
  label,
  description,
  disabled,
  loading,
  className,
  controlClassName,
  labelClassName,
  descriptionClassName,
  ripple,
  ...switchProps
}: Props) => {
  return (
    <Interactive
      asLabel
      clickable
      ripple={ripple}
      disabled={disabled}
      loading={loading}
      className={className}
    >
      <Control inputEnd className={controlClassName}>
        <Switch {...switchProps} />
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

export default memo(SwitchField);
