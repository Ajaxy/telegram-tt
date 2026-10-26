import type { ElementRef } from '../../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../../lib/teact/teact';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { drawStarBurst, ROW_STARS_DURATION } from './helpers/rowEffects';

import styles from './WalletRowOverlay.module.scss';

type OwnProps = {
  // The stars fly out of the center of this element
  originRef: ElementRef<HTMLElement>;
  onEnd: NoneToVoidFunction;
};

const MAX_PIXEL_RATIO = 2;

const WalletRowOverlay = ({ originRef, onEnd }: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const startedAt = performance.now();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    let frameId = 0;
    let isCancelled = false;

    requestMeasure(() => {
      if (isCancelled) return;

      const rect = canvas.getBoundingClientRect();
      const originRect = originRef.current!.getBoundingClientRect();
      const { width, height } = rect;
      const origin = {
        x: originRect.left + originRect.width / 2 - rect.left,
        y: originRect.top + originRect.height / 2 - rect.top,
      };

      requestMutation(() => {
        if (isCancelled) return;

        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);

        function draw() {
          const time = (performance.now() - startedAt) / 1000;
          context!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          context!.clearRect(0, 0, width, height);

          if (time >= ROW_STARS_DURATION) {
            onEnd();
            return;
          }

          drawStarBurst(context!, time, origin);

          frameId = requestAnimationFrame(draw);
        }

        draw();
      });
    });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [originRef, onEnd]);

  return <canvas ref={canvasRef} className={styles.root} />;
};

export default memo(WalletRowOverlay);
