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
  nonInteractive?: boolean;
  className?: string;
  onChange?: (value: string) => void;
};

type Props = OwnProps & Omit<InputProps, keyof OwnProps | 'type'>;

const Radio = ({
  value,
  checked,
  disabled,
  nonInteractive,
  className,
  onChange,
  onClick,
  id,
  tabIndex,
  ...restProps
}: Props) => {
  const control = useControlContext();
  const interactive = useInteractiveContext();

  const resolvedId = id ?? control?.id;
  const isDisabled = disabled || interactive?.isDisabled || interactive?.isLoading;
  const isNonInteractive = nonInteractive;

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLInputElement>) => {
    if (isNonInteractive) {
      e.preventDefault();
      return;
    }

    onClick?.(e);
  });

  const handleChange = useLastCallback(() => {
    if (isNonInteractive) return;

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
        isNonInteractive && styles.nonInteractive,
        className,
      )}
      tabIndex={isNonInteractive ? -1 : tabIndex}
      aria-disabled={isNonInteractive || undefined}
      onClick={handleClick}
      onChange={handleChange}
    />
  );
};

export default memo(Radio);
