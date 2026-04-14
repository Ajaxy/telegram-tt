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
  className,
  onChange,
  id,
  ...restProps
}: Props) => {
  const control = useControlContext();
  const interactive = useInteractiveContext();
  const ref = useRef<HTMLInputElement>();

  const resolvedId = id ?? control?.id;
  const isDisabled = disabled || interactive?.isDisabled || interactive?.isLoading;

  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  const handleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        className,
      )}
      onChange={handleChange}
    />
  );
};

export default memo(Checkbox);
