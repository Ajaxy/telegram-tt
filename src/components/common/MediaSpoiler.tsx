import { memo, useEffect, useRef } from '../../lib/teact/teact';

import type { GpuCanvas } from '../../lib/gpuCanvas/gpuCanvas';

import { requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';
import { createGpuCanvas, getIsGpuCanvasAvailable } from '../../lib/gpuCanvas/gpuCanvas';
import { selectCanAnimateInterface } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useSelector from '../../hooks/data/useSelector';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useDerivedState from '../../hooks/useDerivedState';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useResizeObserver from '../../hooks/useResizeObserver';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';
import useDevicePixelRatio from '../../hooks/window/useDevicePixelRatio';

import Icon from './icons/Icon';

import styles from './MediaSpoiler.module.scss';

type OwnProps = {
  isVisible: boolean;
  withAnimation?: boolean;
  thumbDataUri?: string;
  isNsfw?: boolean;
  width?: number;
  height?: number;
  className?: string;
};

const BLUR_RADIUS = 25;
const ANIMATION_DURATION = 500;

const MediaSpoiler = ({
  isVisible,
  withAnimation,
  thumbDataUri,
  isNsfw,
  className,
  width,
  height,
}: OwnProps) => {
  const ref = useRef<HTMLDivElement>();
  const particlesRef = useRef<HTMLCanvasElement>();
  const gpuCanvasRef = useRef<GpuCanvas>();
  const revealOriginRef = useRef<{ x: number; y: number }>();

  const lang = useLang();
  const canUseGpuCanvas = useDerivedState(getIsGpuCanvasAvailable);

  const canAnimate = useSelector(selectCanAnimateInterface);

  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(
    isVisible, undefined, true, withAnimation ? false : undefined, !canAnimate, ANIMATION_DURATION,
  );
  const canvasRef = useCanvasBlur(thumbDataUri, !shouldRender, undefined, BLUR_RADIUS, width, height);

  const resizeParticles = useLastCallback(() => {
    requestMeasure(() => {
      const canvas = particlesRef.current;
      if (canvas) gpuCanvasRef.current?.resize(canvas.offsetWidth, canvas.offsetHeight);
    });
  });

  useEffect(() => {
    const canvas = particlesRef.current;
    if (!canUseGpuCanvas || !shouldRender || !canvas) return undefined;

    const gpuCanvas = createGpuCanvas(canvas, 'media');
    gpuCanvasRef.current = gpuCanvas;
    resizeParticles();

    return () => {
      gpuCanvas.destroy();
      gpuCanvasRef.current = undefined;
    };
  }, [canUseGpuCanvas, shouldRender, resizeParticles]);

  useResizeObserver(ref, resizeParticles, !canUseGpuCanvas || !shouldRender);
  const dpr = useDevicePixelRatio();
  useEffect(resizeParticles, [dpr, resizeParticles]);

  // A click may only load the media or ask for confirmation, so the particles go away with the spoiler itself
  useEffect(() => {
    if (isVisible || !withAnimation) return;

    const origin = revealOriginRef.current;
    revealOriginRef.current = undefined;
    requestMeasure(() => {
      const el = ref.current;
      if (!el) return;

      gpuCanvasRef.current?.reveal(origin?.x ?? el.offsetWidth / 2, origin?.y ?? el.offsetHeight / 2);
    });
  }, [isVisible, withAnimation]);

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const el = ref.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const shiftX = x - (rect.width / 2);
    const shiftY = y - (rect.height / 2);
    revealOriginRef.current = { x, y };
    requestMutation(() => {
      el.setAttribute('style', `--click-shift-x: ${shiftX}px; --click-shift-y: ${shiftY}px`);
    });
  });

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div
      className={buildClassName(styles.root, transitionClassNames, className, withAnimation && styles.maskAnimation)}
      ref={ref}
      onClick={withAnimation ? handleClick : undefined}
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={width}
        height={height}
      />
      {canUseGpuCanvas
        ? <canvas key="particles" ref={particlesRef} className={styles.particles} />
        : <div key="dots" className={styles.dots} />}
      {isNsfw && (
        <span className={styles.nsfw}>
          <Icon name="eye-crossed-outline" className={styles.nsfwIcon} />
          {lang('MediaSpoilerSensitive')}
        </span>
      )}
    </div>
  );
};

export default memo(MediaSpoiler);
