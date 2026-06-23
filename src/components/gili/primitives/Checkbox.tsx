import { memo, useLayoutEffect, useRef } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import { useControlContext } from '../layout/Control';
import { useInteractiveContext } from '../layout/Interactive';

import styles from './Checkbox.module.scss';

type InputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>;

type OwnProps = {
  checked?: boolean;
  disabled?: boolean;
  isRound?: boolean;
  indeterminate?: boolean;
  isInvalid?: boolean;
  nonInteractive?: boolean;
  className?: string;
  onChange?: (checked: boolean) => void;
};

type Props = OwnProps & Omit<InputProps, keyof OwnProps | 'type'>;

const Checkbox = ({
  checked,
  disabled,
  isRound,
  indeterminate,
  isInvalid,
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
  const ref = useRef<HTMLInputElement>();

  const resolvedId = id ?? control?.id;
  const isDisabled = disabled || interactive?.isDisabled || interactive?.isLoading;
  const isNonInteractive = nonInteractive;

  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLInputElement>) => {
    if (isNonInteractive) {
      e.preventDefault();
      return;
    }

    onClick?.(e);
  });

  const handleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isNonInteractive) return;

    onChange?.(e.currentTarget.checked);
  });

  if (interactive?.isLoading) return undefined;

  return (
    <input
      {...restProps}
      ref={ref}
      type="checkbox"
      id={resolvedId}
      checked={checked}
      disabled={isDisabled}
      className={buildClassName(
        styles.root,
        control?.inputClassName,
        isInvalid && styles.invalid,
        isRound && styles.round,
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

export default memo(Checkbox);
