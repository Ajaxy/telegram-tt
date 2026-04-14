import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import { useControlContext } from '../layout/Control';
import { useInteractiveContext } from '../layout/Interactive';

import styles from './Switch.module.scss';

type InputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>;

type OwnProps = {
  checked: boolean;
  disabled?: boolean;
  withPermissionColors?: boolean;
  className?: string;
  onChange: (checked: boolean) => void;
};

type Props = OwnProps & Omit<InputProps, keyof OwnProps | 'type'>;

const Switch = ({
  checked,
  disabled,
  withPermissionColors,
  className,
  onChange,
  id,
  ...restProps
}: Props) => {
  const control = useControlContext();
  const interactive = useInteractiveContext();

  const resolvedId = id ?? control?.id;
  const isDisabled = disabled || interactive?.isDisabled || interactive?.isLoading;

  const handleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.checked);
  });

  if (interactive?.isLoading) return undefined;

  return (
    <input
      {...restProps}
      type="checkbox"
      role="switch"
      id={resolvedId}
      checked={checked}
      disabled={isDisabled}
      className={buildClassName(
        styles.root,
        withPermissionColors && styles.permissionColors,
        control?.inputClassName,
        className,
      )}
      onChange={handleChange}
    />
  );
};

export default memo(Switch);
