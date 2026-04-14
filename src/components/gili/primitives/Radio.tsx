import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import { useControlContext } from '../layout/Control';
import { useInteractiveContext } from '../layout/Interactive';

import styles from './Radio.module.scss';

type InputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>;

type OwnProps = {
  value: string;
  checked?: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: (value: string) => void;
};

type Props = OwnProps & Omit<InputProps, keyof OwnProps | 'type'>;

const Radio = ({
  value,
  checked,
  disabled,
  className,
  onChange,
  id,
  ...restProps
}: Props) => {
  const control = useControlContext();
  const interactive = useInteractiveContext();

  const resolvedId = id ?? control?.id;
  const isDisabled = disabled || interactive?.isDisabled || interactive?.isLoading;

  const handleChange = useLastCallback(() => {
    onChange?.(value);
  });

  if (interactive?.isLoading) return undefined;

  return (
    <input
      type="radio"
      {...restProps}
      id={resolvedId}
      value={value}
      checked={checked}
      disabled={isDisabled}
      className={buildClassName(
        styles.root,
        control?.inputClassName,
        className,
      )}
      onChange={handleChange}
    />
  );
};

export default memo(Radio);
