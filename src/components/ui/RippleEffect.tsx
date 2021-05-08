import React, {
  FC, useCallback, useMemo, useState, memo,
} from '../../lib/teact/teact';
import { debounce } from '../../util/schedulers';

import './RippleEffect.scss';

interface Ripple {
  x: number;
  y: number;
  size: number;
}

const ANIMATION_DURATION_MS = 700;

const RippleEffect: FC = () => {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const cleanUpDebounced = useMemo(() => {
    return debounce(() => {
      setRipples([]);
    }, ANIMATION_DURATION_MS, false);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (e.button !== 0) {
      return;
    }

    const container = e.currentTarget as HTMLDivElement;
    const position = container.getBoundingClientRect() as DOMRect;

    const rippleSize = container.offsetWidth / 2;

    setRipples([
      ...ripples,
      {
        x: e.clientX - position.x - (rippleSize / 2),
        y: e.clientY - position.y - (rippleSize / 2),
        size: rippleSize,
      },
    ]);

    requestAnimationFrame(() => {
      cleanUpDebounced();
    });
  }, [ripples, cleanUpDebounced]);

  return (
    <div className="ripple-container" onMouseDown={handleMouseDown}>
      {ripples.map(({ x, y, size }: Ripple) => (
        <span
          // @ts-ignore
          style={`left: ${x}px; top: ${y}px; width: ${size}px; height: ${size}px;`}
        />
      ))}
    </div>
  );
};

export default memo(RippleEffect);
