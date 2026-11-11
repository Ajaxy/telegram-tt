import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { clamp } from '../../../util/math';

import useLastCallback from '../../../hooks/useLastCallback';

import styles from './Slider.module.scss';

type InputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>;

type OwnProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  onReset?: NoneToVoidFunction;
};

type Props = OwnProps & Omit<InputProps, keyof OwnProps | 'type'>;

const Slider = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  className,
  onChange,
  onChangeEnd,
  onReset,
  ...restProps
}: Props) => {
  const range = max - min;
  const valueRatio = (clamp(value, min, max) - min) / range;
  const originRatio = (clamp(0, min, max) - min) / range;

  const handleChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.currentTarget.value));
  });

  const handleChangeEnd = useLastCallback((e: React.UIEvent<HTMLInputElement>) => {
    onChangeEnd?.(Number(e.currentTarget.value));
  });

  return (
    <div
      className={buildClassName(
        styles.root,
        valueRatio !== originRatio && styles.active,
        disabled && styles.disabled,
        className,
      )}
      style={buildStyle(
        `--value: ${valueRatio}`,
        `--fill-start: ${Math.min(valueRatio, originRatio)}`,
        `--fill-length: ${Math.abs(valueRatio - originRatio)}`,
      )}
    >
      <input
        {...restProps}
        type="range"
        className={styles.input}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onPointerUp={handleChangeEnd}
        onPointerCancel={handleChangeEnd}
        onKeyUp={handleChangeEnd}
        onDoubleClick={onReset}
      />
      <span className={styles.track} aria-hidden>
        <span className={styles.fill} />
      </span>
      <span className={styles.thumb} aria-hidden />
    </div>
  );
};

export default memo(Slider);
