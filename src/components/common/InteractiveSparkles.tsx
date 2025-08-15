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

const InteractiveSparkles = ({
  color = 'purple',
  centerShift = DEFAULT_PARTICLE_PARAMS.centerShift,
  isDisabled,
  className,
  onRequestAnimation,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();

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
