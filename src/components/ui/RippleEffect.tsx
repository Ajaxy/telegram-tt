import { memo, useEffect, useMemo, useRef, useState } from '../../lib/teact/teact';

import { debounce } from '../../util/schedulers';

import useLastCallback from '../../hooks/useLastCallback';

import './RippleEffect.scss';

interface Ripple {
  x: number;
  y: number;
  size: number;
}

const ANIMATION_DURATION_MS = 700;

const RippleEffect = () => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const containerRef = useRef<HTMLDivElement>();

  const cleanUpDebounced = useMemo(() => {
    return debounce(() => {
      setRipples([]);
    }, ANIMATION_DURATION_MS, false);
  }, []);

  const handleMouseDown = useLastCallback((e: MouseEvent) => {
    if (e.button !== 0) return;

    const parent = containerRef.current?.parentElement;
    if (!parent) return;

    const position = parent.getBoundingClientRect();
    const rippleSize = parent.offsetWidth / 2;

    setRipples((prev) => [
      ...prev,
      {
        x: e.clientX - position.x - (rippleSize / 2),
        y: e.clientY - position.y - (rippleSize / 2),
        size: rippleSize,
      },
    ]);

    cleanUpDebounced();
  });

  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return undefined;

    parent.addEventListener('mousedown', handleMouseDown);
    return () => parent.removeEventListener('mousedown', handleMouseDown);
  }, [handleMouseDown]);

  return (
    <div ref={containerRef} className="ripple-container">
      {ripples.map(({ x, y, size }) => (
        <div
          className="ripple-wave"
          style={`left: ${x}px; top: ${y}px; width: ${size}px; height: ${size}px;`}
        />
      ))}
    </div>
  );
};

export default memo(RippleEffect);
