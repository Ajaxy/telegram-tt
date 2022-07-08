import React, { memo, useRef } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';
import type { FC } from '../../lib/teact/teact';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { pick } from '../../util/iteratees';
import buildStyle from '../../util/buildStyle';

import useWindowSize from '../../hooks/useWindowSize';
import useOnChange from '../../hooks/useOnChange';
import useForceUpdate from '../../hooks/useForceUpdate';

import styles from './ConfettiContainer.module.scss';

type StateProps = {
  confetti?: GlobalState['confetti'];
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
const DEFAULT_CONFETTI_SIZE = 10;
const CONFETTI_COLORS = ['#E8BC2C', '#D0049E', '#02CBFE', '#5723FD', '#FE8C27', '#6CB859'];

const ConfettiContainer: FC<StateProps> = ({ confetti }) => {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<Confetti[]>([]);
  const isRafStartedRef = useRef(false);
  const windowSize = useWindowSize();
  const forceUpdate = useForceUpdate();

  const {
    lastConfettiTime, top, width, left, height,
  } = confetti || {};

  function generateConfetti(w: number, h: number, amount = DEFAULT_CONFETTI_AMOUNT) {
    for (let i = 0; i < amount; i++) {
      const leftSide = i % 2;
      const pos = {
        x: w * (leftSide ? -0.1 : 1.1),
        y: h * 0.75,
      };
      const randomX = Math.random() * w * 1.5;
      const randomY = -h / 2 - Math.random() * h;
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

    const { width: canvasWidth, height: canvasHeight } = canvas;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const confettiToRemove: Confetti[] = [];
    confettiRef.current.forEach((c, i) => {
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
      } = c;
      const diff = (Date.now() - lastDrawnAt) / 1000;

      const newPos = {
        x: pos.x + velocity.x * diff,
        y: pos.y + velocity.y * diff,
      };

      const newVelocity = {
        x: velocity.x * 0.98, // Air Resistance
        y: velocity.y += diff * 1000, // Gravity
      };

      const newFlicker = size * Math.abs(Math.sin(frameCount * flickerFrequency));
      const newRotation = 5 * frameCount * flickerFrequency * (Math.PI / 180);

      const newFrameCount = frameCount + 1;
      const newLastDrawnAt = Date.now();

      const shouldRemove = newPos.y > canvasHeight + c.size;
      if (shouldRemove) {
        confettiToRemove.push(c);
        return;
      }

      const newConfetti = {
        ...c,
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
    confettiRef.current = confettiRef.current.filter((c) => !confettiToRemove.includes(c));
    if (confettiRef.current.length) {
      requestAnimationFrame(updateCanvas);
    } else {
      isRafStartedRef.current = false;
    }
  };

  useOnChange(([prevConfettiTime]) => {
    let hideTimeout: ReturnType<typeof setTimeout>;
    if (prevConfettiTime !== lastConfettiTime) {
      generateConfetti(width || windowSize.width, height || windowSize.height);
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
  }, [lastConfettiTime, updateCanvas]);

  if (!lastConfettiTime || Date.now() - lastConfettiTime > CONFETTI_FADEOUT_TIMEOUT) {
    return undefined;
  }

  const style = buildStyle(
    Boolean(top) && `top: ${top}px`,
    Boolean(left) && `left: ${left}px`,
    Boolean(width) && `width: ${width}px`,
    Boolean(height) && `height: ${height}px`,
  );

  return (
    <div id="Confetti" className={styles.root} style={style}>
      <canvas ref={canvasRef} className={styles.canvas} width={windowSize.width} height={windowSize.height} />
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['confetti']),
)(ConfettiContainer));
