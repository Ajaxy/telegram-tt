import { memo } from '@teact';

import getPointerPosition from '../../../util/events/getPointerPosition';
import { clamp } from '../../../util/math';

import useLastCallback from '../../../hooks/useLastCallback';

import styles from './RotationSlider.module.scss';

type OwnProps = {
  value: number;
  onChange: (value: number) => void;
  onChangeEnd?: NoneToVoidFunction;
};

const MIN_ROTATION = -90;
const MAX_ROTATION = 90;
const LABEL_INTERVAL = 15;
const PIXELS_PER_DEGREE = 5;

function RotationSlider({ value, onChange, onChangeEnd }: OwnProps) {
  const handlePointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { x: startX } = getPointerPosition(e);
    const startValue = value;

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      ev.preventDefault();
      const { x: clientX } = getPointerPosition(ev);
      const deltaX = clientX - startX;
      const newValue = clamp(Math.round(startValue - deltaX / PIXELS_PER_DEGREE), MIN_ROTATION, MAX_ROTATION);
      onChange(newValue);
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchend', handleUp);
      onChangeEnd?.();
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchend', handleUp);
  });

  const nearestLabel = Math.round(value / LABEL_INTERVAL) * LABEL_INTERVAL;
  const trackOffset = -value * PIXELS_PER_DEGREE;

  const labels = [];
  for (let deg = MIN_ROTATION; deg <= MAX_ROTATION; deg += LABEL_INTERVAL) {
    labels.push(
      <span
        key={deg}
        className={deg === nearestLabel ? styles.labelActive : styles.label}
        style={`left: ${deg * PIXELS_PER_DEGREE}px`}
      >
        {deg}
      </span>,
    );
  }

  return (
    <div className={styles.root}>
      <div
        className={styles.slider}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
      >
        <div className={styles.track} style={`transform: translateX(${trackOffset}px)`}>
          <div className={styles.labelsRow}>
            {labels}
          </div>
          <div className={styles.dotsRow} />
        </div>
        <div className={styles.centerIndicator} />
      </div>
    </div>
  );
}

export default memo(RotationSlider);
