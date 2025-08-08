import type { TeactNode } from '@teact';
import { memo, useLayoutEffect, useRef } from '@teact';

import { PARTICLE_BURST_PARAMS, PARTICLE_COLORS, setupParticles } from '../../../util/particles.ts';

import useLastCallback from '../../../hooks/useLastCallback.ts';

import SpeedingDiamond from './SpeedingDiamond.tsx';
import SwayingStar from './SwayingStar.tsx';

import styles from './ParticlesHeader.module.scss';

interface OwnProps {
  model: 'swaying-star' | 'speeding-diamond';
  color: 'purple' | 'gold' | 'blue';
  title: TeactNode;
  description: TeactNode;
  isDisabled?: boolean;
}

const PARTICLE_PARAMS = {
  centerShift: [0, -36] as const,
};

function ParticlesHeader({
  model,
  color,
  title,
  description,
  isDisabled,
}: OwnProps) {
  const canvasRef = useRef<HTMLCanvasElement>();

  useLayoutEffect(() => {
    if (isDisabled) return undefined;

    return setupParticles(canvasRef.current!, {
      color: PARTICLE_COLORS[`${color}Gradient`],
      ...PARTICLE_PARAMS,
    });
  }, [color, isDisabled]);

  const handleMouseMove = useLastCallback(() => {
    setupParticles(canvasRef.current!, {
      color: PARTICLE_COLORS[`${color}Gradient`],
      ...PARTICLE_PARAMS,
      ...PARTICLE_BURST_PARAMS,
    });
  });

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.particles} />

      {model === 'swaying-star' ? (
        <SwayingStar
          color={color as 'purple' | 'gold'}
          centerShift={PARTICLE_PARAMS.centerShift}
          onMouseMove={handleMouseMove}
        />
      ) : model === 'speeding-diamond' && (
        <SpeedingDiamond onMouseMove={handleMouseMove} />
      )}

      <h2 className={styles.title}>
        {title}
      </h2>

      <div className={styles.description}>
        {description}
      </div>
    </div>
  );
}

export default memo(ParticlesHeader);
