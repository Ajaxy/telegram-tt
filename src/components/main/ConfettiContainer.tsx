import React, { memo, useRef } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { pick } from '../../util/iteratees';

import useWindowSize from '../../hooks/useWindowSize';
import useOnChange from '../../hooks/useOnChange';
import useForceUpdate from '../../hooks/useForceUpdate';

import styles from './ConfettiContainer.module.scss';

type StateProps = {
  lastConfettiTime?: number;
};

interface Confetti {
  pos: {
    x: number;
    y: number;
  };
  velocity: {
    x: number;
    y: number;
  };
  size: number;
  color: string;
  flicker: number;
  flickerFrequency: number;
  rotation: number;
  lastDrawnAt: number;
  frameCount: number;
}

const CONFETTI_FADEOUT_TIMEOUT = 10000;
const DEFAULT_CONFETTI_AMOUNT = IS_SINGLE_COLUMN_LAYOUT ? 50 : 100;
const DEFAULT_CONFETTI_SIZE = 15;
const CONFETTI_COLORS = ['#E8BC2C', '#D0049E', '#02CBFE', '#5723FD', '#FE8C27', '#6CB859'];

const ConfettiContainer: FC<StateProps> = ({ lastConfettiTime }) => {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<Confetti[]>([]);
  const isRafStartedRef = useRef(false);
  const windowSize = useWindowSize();
  const forceUpdate = useForceUpdate();

  function generateConfetti(width: number, height: number, amount = DEFAULT_CONFETTI_AMOUNT) {
    for (let i = 0; i < amount; i++) {
      const leftSide = i % 2;
      const pos = {
        x: width * (leftSide ? -0.1 : 1.1),
        y: height * 0.75,
      };
      const randomX = Math.random() * width * 0.8;
      const randomY = -height / 2 - Math.random() * height * 0.5;
      const velocity = {
        x: leftSide ? randomX : randomX * -1,
        y: randomY,
      };

      const randomColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const size = DEFAULT_CONFETTI_SIZE;
      confettiRef.current.push({
        pos,
        size,
        color: randomColor,
        velocity,
        flicker: size,
        flickerFrequency: Math.random() * 0.2,
        rotation: 0,
        lastDrawnAt: Date.now(),
        frameCount: 0,
      });
    }
  }

  const updateCanvas = () => {
    if (!canvasRef.current || !isRafStartedRef.current) {
      return;
    }
    const canvas = canvasRef.current;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const confettiToRemove: Confetti[] = [];
    confettiRef.current.forEach((confetti, i) => {
      const {
        pos,
        velocity,
        size,
        color,
        flicker,
        flickerFrequency,
        rotation,
        lastDrawnAt,
        frameCount,
      } = confetti;
      const diff = (Date.now() - lastDrawnAt) / 1000;

      const newPos = {
        x: pos.x + velocity.x * diff,
        y: pos.y + velocity.y * diff,
      };

      const newVelocity = {
        x: velocity.x * 0.99, // Air Resistance
        y: velocity.y += diff * 500, // Gravity
      };

      const newFlicker = size * Math.abs(Math.sin(frameCount * flickerFrequency));
      const newRotation = 5 * frameCount * flickerFrequency * (Math.PI / 180);

      const newFrameCount = frameCount + 1;
      const newLastDrawnAt = Date.now();

      const shouldRemove = newPos.y > height + confetti.size;
      if (shouldRemove) {
        confettiToRemove.push(confetti);
        return;
      }

      const newConfetti = {
        ...confetti,
        pos: newPos,
        velocity: newVelocity,
        flicker: newFlicker,
        rotation: newRotation,
        lastDrawnAt: newLastDrawnAt,
        frameCount: newFrameCount,
      };

      confettiRef.current[i] = newConfetti;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(
        pos.x,
        pos.y,
        size,
        flicker,
        rotation,
        0,
        2 * Math.PI,
      );
      ctx.fill();
    });
    confettiRef.current = confettiRef.current.filter((confetti) => !confettiToRemove.includes(confetti));
    if (confettiRef.current.length) {
      requestAnimationFrame(updateCanvas);
    } else {
      isRafStartedRef.current = false;
    }
  };

  useOnChange(([prevConfettiTime]) => {
    let hideTimeout: ReturnType<typeof setTimeout>;
    if (prevConfettiTime !== lastConfettiTime) {
      generateConfetti(windowSize.width, windowSize.height);
      hideTimeout = setTimeout(forceUpdate, CONFETTI_FADEOUT_TIMEOUT);
      if (!isRafStartedRef.current) {
        isRafStartedRef.current = true;
        requestAnimationFrame(updateCanvas);
      }
    }
    return () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    };
  }, [lastConfettiTime, updateCanvas, windowSize]);

  if (!lastConfettiTime || Date.now() - lastConfettiTime > CONFETTI_FADEOUT_TIMEOUT) {
    return undefined;
  }

  return (
    <div id="Confetti" className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} width={windowSize.width} height={windowSize.height} />
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['lastConfettiTime']),
)(ConfettiContainer));
