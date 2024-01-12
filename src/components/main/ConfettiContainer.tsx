import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback, useRef } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { TabState } from '../../global/types';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import { selectTabState } from '../../global/selectors';
import buildStyle from '../../util/buildStyle';
import { pick } from '../../util/iteratees';

import useAppLayout from '../../hooks/useAppLayout';
import useForceUpdate from '../../hooks/useForceUpdate';
import useSyncEffect from '../../hooks/useSyncEffect';
import useWindowSize from '../../hooks/window/useWindowSize';

import styles from './ConfettiContainer.module.scss';

type StateProps = {
  confetti?: TabState['confetti'];
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
const DEFAULT_CONFETTI_SIZE = 10;
const CONFETTI_COLORS = ['#E8BC2C', '#D0049E', '#02CBFE', '#5723FD', '#FE8C27', '#6CB859'];

const ConfettiContainer: FC<StateProps> = ({ confetti }) => {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<Confetti[]>([]);
  const isRafStartedRef = useRef(false);
  const windowSize = useWindowSize();
  const forceUpdate = useForceUpdate();
  const { isMobile } = useAppLayout();

  const defaultConfettiAmount = isMobile ? 50 : 100;
  const {
    lastConfettiTime, top, width, left, height,
  } = confetti || {};

  const generateConfetti = useCallback((w: number, h: number, amount = defaultConfettiAmount) => {
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
  }, [defaultConfettiAmount]);

  const updateCanvas = useCallback(() => {
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
      requestMeasure(updateCanvas);
    } else {
      isRafStartedRef.current = false;
    }
  }, []);

  useSyncEffect(([prevConfettiTime]) => {
    let hideTimeout: ReturnType<typeof setTimeout>;
    if (prevConfettiTime !== lastConfettiTime) {
      generateConfetti(width || windowSize.width, height || windowSize.height);
      hideTimeout = setTimeout(forceUpdate, CONFETTI_FADEOUT_TIMEOUT);
      if (!isRafStartedRef.current) {
        isRafStartedRef.current = true;
        requestMeasure(updateCanvas);
      }
    }
    return () => {
      clearTimeout(hideTimeout);
    };
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps -- Old timeout should be cleared only if new confetti is generated
  }, [lastConfettiTime, forceUpdate, updateCanvas]);

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
  (global): StateProps => pick(selectTabState(global), ['confetti']),
)(ConfettiContainer));
