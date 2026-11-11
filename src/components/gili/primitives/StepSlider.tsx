import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import styles from './StepSlider.module.scss';

type InputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>;

type OwnProps = {
  stepCount: number;
  value: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
};

type Props = OwnProps & Omit<InputProps, keyof OwnProps | 'type'>;

const StepSlider = ({
  stepCount,
  value,
  disabled,
  className,
  onChange,
  ...restProps
}: Props) => {
  const handleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.currentTarget.value));
  });

  return (
    <div className={buildClassName(styles.root, disabled && styles.disabled, className)}>
      <input
        {...restProps}
        type="range"
        className={styles.input}
        min={0}
        max={stepCount - 1}
        step={1}
        value={value}
        disabled={disabled}
        onChange={handleChange}
      />
      <span className={styles.steps} aria-hidden>
        {Array.from({ length: stepCount }, (_, index) => (
          <>
            {index > 0 && <span className={buildClassName(styles.bar, index <= value && styles.active)} />}
            <span
              className={buildClassName(
                styles.dot,
                index <= value && styles.active,
                index === value && styles.selected,
              )}
            />
          </>
        ))}
      </span>
    </div>
  );
};

export default memo(StepSlider);
