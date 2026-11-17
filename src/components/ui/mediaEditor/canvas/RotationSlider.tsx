import { memo } from '@teact';

import getPointerPosition from '../../../../util/events/getPointerPosition';
import { clamp } from '../../../../util/math';

import useLastCallback from '../../../../hooks/useLastCallback';
import useWindow from '../../../../hooks/useWindow';

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
  const renderingWindow = useWindow();

  const handlePointerDown = useLastCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { x: startX } = getPointerPosition(e);
    const startValue = value;
    const targetDocument = renderingWindow.document;

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      ev.preventDefault();
      const { x: clientX } = getPointerPosition(ev);
      const deltaX = clientX - startX;
      const newValue = clamp(Math.round(startValue - deltaX / PIXELS_PER_DEGREE), MIN_ROTATION, MAX_ROTATION);
      onChange(newValue);
    };

    const handleUp = () => {
      targetDocument.removeEventListener('mousemove', handleMove);
      targetDocument.removeEventListener('touchmove', handleMove);
      targetDocument.removeEventListener('mouseup', handleUp);
      targetDocument.removeEventListener('touchend', handleUp);
      targetDocument.removeEventListener('touchcancel', handleUp);
      onChangeEnd?.();
    };

    targetDocument.addEventListener('mousemove', handleMove);
    targetDocument.addEventListener('touchmove', handleMove, { passive: false });
    targetDocument.addEventListener('mouseup', handleUp);
    targetDocument.addEventListener('touchend', handleUp);
    targetDocument.addEventListener('touchcancel', handleUp);
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
