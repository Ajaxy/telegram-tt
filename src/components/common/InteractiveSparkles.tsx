import { memo, useEffect, useLayoutEffect, useRef } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { PARTICLE_BURST_PARAMS, PARTICLE_COLORS, setupParticles } from '../../util/particles';

import styles from './InteractiveSparkles.module.scss';

interface OwnProps {
  color?: 'purple' | 'gold' | 'blue';
  centerShift?: readonly [number, number];
  isDisabled?: boolean;
  className?: string;
  onRequestAnimation?: (animate: NoneToVoidFunction) => void;
}

const DEFAULT_PARTICLE_PARAMS = {
  centerShift: [0, -36] as const,
};

// A burst comes with every pointer move, which a 120 Hz display reports twice as often. At most one burst per 15 ms
// keeps it near 60 per second there, and staying just under a 60 Hz frame (16.7 ms) lets a move that comes a
// millisecond early still count.
const MIN_BURST_INTERVAL = 15;

const InteractiveSparkles = ({
  color = 'purple',
  centerShift = DEFAULT_PARTICLE_PARAMS.centerShift,
  isDisabled,
  className,
  onRequestAnimation,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const lastBurstTimeRef = useRef<number>(0);

  useLayoutEffect(() => {
    if (isDisabled) return undefined;

    return setupParticles(canvasRef.current!, {
      color: PARTICLE_COLORS[`${color}Gradient`],
      centerShift,
    });
  }, [centerShift, color, isDisabled]);

  useEffect(() => {
    if (!onRequestAnimation) return;

    const animate = () => {
      if (isDisabled) return;

      const now = Date.now();
      if (now - lastBurstTimeRef.current < MIN_BURST_INTERVAL) return;

      lastBurstTimeRef.current = now;

      setupParticles(canvasRef.current!, {
        color: PARTICLE_COLORS[`${color}Gradient`],
        centerShift,
        ...PARTICLE_BURST_PARAMS,
      });
    };

    onRequestAnimation(animate);
  }, [centerShift, color, isDisabled, onRequestAnimation]);

  return (
    <canvas
      ref={canvasRef}
      className={buildClassName(styles.sparkles, className)}
    />
  );
};

export default memo(InteractiveSparkles);
