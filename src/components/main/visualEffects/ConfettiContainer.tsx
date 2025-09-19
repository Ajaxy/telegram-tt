import { memo, useRef } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';
import type { ConfettiStyle } from '../../../types';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { selectTabState } from '../../../global/selectors';
import buildStyle from '../../../util/buildStyle';
import { pick } from '../../../util/iteratees';

import useAppLayout from '../../../hooks/useAppLayout';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useLastCallback from '../../../hooks/useLastCallback';
import useSyncEffect from '../../../hooks/useSyncEffect';
import useWindowSize from '../../../hooks/window/useWindowSize';

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
  isStar?: boolean;
  flicker: number;
  flickerFrequency: number;
  rotation: number;
  lastDrawnAt: number;
  frameCount: number;
}

const CONFETTI_FADEOUT_TIMEOUT = 10000;
const DEFAULT_CONFETTI_SIZE = 10;
const CONFETTI_COLORS = ['#E8BC2C', '#D0049E', '#02CBFE', '#5723FD', '#FE8C27', '#6CB859'];
// eslint-disable-next-line @stylistic/max-len
const STAR_PATH = new Path2D('M6.63869 12.1902L3.50621 14.1092C3.18049 14.3087 2.75468 14.2064 2.55515 13.8807C2.45769 13.7216 2.42864 13.5299 2.47457 13.3491L2.95948 11.4405C3.13452 10.7515 3.60599 10.1756 4.24682 9.86791L7.6642 8.22716C7.82352 8.15067 7.89067 7.95951 7.81418 7.80019C7.75223 7.67116 7.61214 7.59896 7.47111 7.62338L3.66713 8.28194C2.89387 8.41581 2.1009 8.20228 1.49941 7.69823L0.297703 6.69116C0.00493565 6.44581 -0.0335059 6.00958 0.211842 5.71682C0.33117 5.57442 0.502766 5.48602 0.687982 5.47153L4.35956 5.18419C4.61895 5.16389 4.845 4.99974 4.94458 4.75937L6.36101 1.3402C6.5072 0.987302 6.91179 0.819734 7.26469 0.965925C7.43413 1.03612 7.56876 1.17075 7.63896 1.3402L9.05539 4.75937C9.15496 4.99974 9.38101 5.16389 9.6404 5.18419L13.3322 5.47311C13.713 5.50291 13.9975 5.83578 13.9677 6.2166C13.9534 6.39979 13.8667 6.56975 13.7269 6.68896L10.9114 9.08928C10.7131 9.25826 10.6267 9.52425 10.6876 9.77748L11.5532 13.3733C11.6426 13.7447 11.414 14.1182 11.0427 14.2076C10.8642 14.2506 10.676 14.2208 10.5195 14.1249L7.36128 12.1902C7.13956 12.0544 6.8604 12.0544 6.63869 12.1902Z');
const STAR_SIZE_MULTIPLIER = 1.5;

const ConfettiContainer = ({ confetti }: StateProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const confettiRef = useRef<Confetti[]>([]);
  const isRafStartedRef = useRef(false);
  const windowSize = useWindowSize();
  const forceUpdate = useForceUpdate();
  const { isMobile } = useAppLayout();

  const defaultConfettiAmount = isMobile ? 50 : 100;
  const {
    lastConfettiTime, top, width, left, height, style = 'poppers',
  } = confetti || {};

  const generateConfetti = useLastCallback((w: number, h: number, amount = defaultConfettiAmount) => {
    for (let i = 0; i < amount; i++) {
      const {
        position, velocity,
      } = generateRandomPositionData(style, w, h, i);

      const size = DEFAULT_CONFETTI_SIZE + randomNumberAroundZero(DEFAULT_CONFETTI_SIZE / 2);

      const randomColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      confettiRef.current.push({
        pos: position,
        size,
        color: randomColor,
        velocity,
        flicker: size,
        flickerFrequency: Math.random() * 0.2,
        rotation: 0,
        lastDrawnAt: Date.now(),
        frameCount: 0,
        isStar: confetti?.withStars && Math.random() > 0.8,
      });
    }
  });

  const updateCanvas = useLastCallback(() => {
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
        x: velocity.x * 0.5 ** (diff / 1), // Air Resistance
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
      if (c.isStar) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.scale(
          (size / DEFAULT_CONFETTI_SIZE) * STAR_SIZE_MULTIPLIER,
          (size / DEFAULT_CONFETTI_SIZE) * STAR_SIZE_MULTIPLIER,
        );
        ctx.rotate(rotation);
        ctx.fill(STAR_PATH);
        ctx.restore();
      } else {
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
      }
    });
    confettiRef.current = confettiRef.current.filter((c) => !confettiToRemove.includes(c));
    if (confettiRef.current.length) {
      requestMeasure(updateCanvas);
    } else {
      isRafStartedRef.current = false;
    }
  });

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

  const containerStyle = buildStyle(
    Boolean(top) && `top: ${top}px`,
    Boolean(left) && `left: ${left}px`,
    Boolean(width) && `width: ${width}px`,
    Boolean(height) && `height: ${height}px`,
  );

  return (
    <div id="Confetti" className={styles.root} style={containerStyle}>
      <canvas ref={canvasRef} className={styles.canvas} width={windowSize.width} height={windowSize.height} />
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => pick(selectTabState(global), ['confetti']) as Complete<StateProps>,
)(ConfettiContainer));

function generateRandomPositionData(
  style: ConfettiStyle, containerWidth: number, containerHeight: number, index: number,
) {
  if (style === 'poppers') {
    const leftSide = index % 2;
    const position = {
      x: containerWidth * (leftSide ? -0.1 : 1.1),
      y: containerHeight * 0.66,
    };
    const randomX = Math.random() * containerWidth;
    const randomY = -containerHeight - randomNumberAroundZero(containerHeight * 0.75);
    const velocity = {
      x: leftSide ? randomX : randomX * -1,
      y: randomY,
    };

    return {
      position,
      velocity,
    };
  } else {
    const position = {
      x: Math.random() * containerWidth,
      y: -DEFAULT_CONFETTI_SIZE * 2,
    };
    const randomX = randomNumberAroundZero(containerWidth);
    const randomY = -containerHeight * Math.random() * 1.25;
    const velocity = {
      x: randomX,
      y: randomY,
    };

    return {
      position,
      velocity,
    };
  }
}

function randomNumberAroundZero(max: number = 1) {
  return Math.random() * max - max / 2;
}
