import { type ElementRef, memo, useLayoutEffect, useRef } from '../../../lib/teact/teact';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { animateInstantly } from '../../../util/animation';
import { drawFrame, MATRIX_DURATION, measureLayout } from './helpers/matrix';

import useLastCallback from '../../../hooks/useLastCallback';

import styles from './WalletRecipientMatrix.module.scss';

type OwnProps = {
  chipRef: ElementRef<HTMLDivElement>;
  avatarRef: ElementRef<HTMLDivElement>;
  // The chip carries it while the canvas draws in place of its contents
  assemblingClassName: string;
  // Every new key plays again; nothing plays without one
  playKey?: string;
  noAnimation?: boolean;
  // The chip can be read again: the play of the key has ended, or it did not run
  onPlayEnd?: (playKey: string) => void;
};

const WalletRecipientMatrix = ({
  chipRef, avatarRef, assemblingClassName, playKey, noAnimation, onPlayEnd,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const handlePlayEnd = useLastCallback((key: string) => onPlayEnd?.(key));

  useLayoutEffect(() => {
    if (!playKey) return undefined;

    const chip = chipRef.current;
    const canvas = canvasRef.current;
    const context = !noAnimation && chip && canvas ? canvas.getContext('2d') : undefined;

    if (!chip || !canvas || !context) {
      handlePlayEnd(playKey);
      return undefined;
    }

    const startTime = performance.now();
    let isStopped = false;
    // The play also stops itself at its end, so a separate flag tells that this effect is gone. A mutation queued
    // before the cleanup must not report the end of an old key.
    let isCleanedUp = false;
    const reportEnd = () => {
      if (!isCleanedUp) handlePlayEnd(playKey);
    };

    chip.classList.add(assemblingClassName);
    canvas.classList.remove(styles.fading);

    requestMeasure(() => {
      if (isStopped) return;

      const layout = measureLayout(chip, avatarRef.current, context);
      if (!layout) {
        requestMutation(() => {
          chip.classList.remove(assemblingClassName);
          reportEnd();
        });
        return;
      }

      requestMutation(() => {
        if (isStopped) return;

        canvas.width = Math.round(layout.width * layout.pixelRatio);
        canvas.height = Math.round(layout.height * layout.pixelRatio);
        canvas.style.width = `${layout.width}px`;
        canvas.style.height = `${layout.height}px`;
        context.setTransform(layout.pixelRatio, 0, 0, layout.pixelRatio, 0, 0);
        context.textAlign = 'center';

        animateInstantly(() => {
          if (isStopped) return false;

          const time = (performance.now() - startTime) / 1000;
          // The markup comes back in the same frame, and the last frame fades out over it
          if (time >= MATRIX_DURATION) {
            isStopped = true;
            requestMutation(() => {
              chip.classList.remove(assemblingClassName);
              canvas.classList.add(styles.fading);
              reportEnd();
            });
            return false;
          }

          drawFrame(context, layout, time);
          return true;
        }, requestAnimationFrame);
      });
    });

    return () => {
      isStopped = true;
      isCleanedUp = true;
      context.clearRect(0, 0, canvas.width, canvas.height);
      chip.classList.remove(assemblingClassName);
    };
  }, [chipRef, avatarRef, assemblingClassName, playKey, noAnimation, handlePlayEnd]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden />;
};

export default memo(WalletRecipientMatrix);
