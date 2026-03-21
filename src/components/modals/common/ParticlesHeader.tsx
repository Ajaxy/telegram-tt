import type { TeactNode } from '@teact';
import { memo, useRef } from '@teact';

import type { ApiSticker } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { REM } from '../../common/helpers/mediaDimensions';

import useLastCallback from '../../../hooks/useLastCallback.ts';

import InteractiveSparkles from '../../common/InteractiveSparkles';
import StickerView from '../../common/StickerView';
import SpeedingDiamond from './SpeedingDiamond.tsx';
import SwayingStar from './SwayingStar.tsx';

import styles from './ParticlesHeader.module.scss';

import Cocoon from '../../../assets/cocoon.webp';

interface OwnProps {
  model: 'swaying-star' | 'speeding-diamond' | 'ai-egg' | 'sticker';
  sticker?: ApiSticker;
  color: 'purple' | 'gold' | 'blue';
  title: TeactNode;
  description: TeactNode;
  isDisabled?: boolean;
  className?: string;
  modelClassName?: string;
}

const GIFT_STICKER_SIZE = 8 * REM;

const PARTICLE_PARAMS = {
  centerShift: [0, -36] as const,
};

function ParticlesHeader({
  model,
  sticker,
  color,
  title,
  description,
  isDisabled,
  className,
  modelClassName,
}: OwnProps) {
  const stickerRef = useRef<HTMLDivElement>();
  const triggerSparklesRef = useRef<(() => void) | undefined>();

  const handleMouseMove = useLastCallback(() => {
    triggerSparklesRef.current?.();
  });

  const handleRequestAnimation = useLastCallback((animate: NoneToVoidFunction) => {
    triggerSparklesRef.current = animate;
  });

  return (
    <div className={buildClassName(styles.root, styles[model], className)}>
      <InteractiveSparkles
        color={color}
        centerShift={PARTICLE_PARAMS.centerShift}
        isDisabled={isDisabled}
        className={styles.particles}
        onRequestAnimation={handleRequestAnimation}
      />

      {model === 'swaying-star' ? (
        <SwayingStar
          className={modelClassName}
          color={color as 'purple' | 'gold'}
          centerShift={PARTICLE_PARAMS.centerShift}
          onMouseMove={handleMouseMove}
        />
      ) : model === 'ai-egg' ? (
        <img
          src={Cocoon}
          alt=""
          role="presentation"
          aria-hidden="true"
          className={buildClassName(styles.cocoon, modelClassName)}
          draggable={false}
          onMouseMove={handleMouseMove}
        />
      ) : model === 'speeding-diamond' ? (
        <SpeedingDiamond className={modelClassName} onMouseMove={handleMouseMove} />
      ) : model === 'sticker' && sticker && (
        <div
          ref={stickerRef}
          className={buildClassName(styles.stickerWrapper, modelClassName)}
          style={`width: ${GIFT_STICKER_SIZE}px; height: ${GIFT_STICKER_SIZE}px`}
          onMouseMove={handleMouseMove}
        >
          <StickerView
            containerRef={stickerRef}
            sticker={sticker}
            size={GIFT_STICKER_SIZE}
            shouldPreloadPreview
            shouldLoop={true}
          />
        </div>
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
