import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import styles from './Sparkles.module.scss';

type ButtonParameters = {
  preset: 'button';
};

type ProgressParameters = {
  preset: 'progress';
};

type PresetParameters = ButtonParameters | ProgressParameters;

type OwnProps = {
  className?: string;
  style?: string;
} & PresetParameters;

const SYMBOL = '✦';
const ANIMATION_DURATION = 5;

// Values are in percents
const BUTTON_POSITIONS = [{
  x: 20,
  y: 0,
  size: 100,
  durationShift: 10,
}, {
  x: 15,
  y: 15,
  size: 75,
  durationShift: 70,
}, {
  x: 10,
  y: 35,
  size: 75,
  durationShift: 90,
}, {
  x: 20,
  y: 70,
  size: 125,
  durationShift: 30,
}, {
  x: 40,
  y: 10,
  size: 125,
  durationShift: 0,
}, {
  x: 45,
  y: 60,
  size: 75,
  durationShift: 60,
}, {
  x: 60,
  y: -10,
  size: 100,
  durationShift: 20,
}, {
  x: 55,
  y: 40,
  size: 75,
  durationShift: 60,
}, {
  x: 70,
  y: 65,
  size: 100,
  durationShift: 90,
}, {
  x: 80,
  y: 10,
  size: 75,
  durationShift: 30,
}, {
  x: 80,
  y: 45,
  size: 125,
  durationShift: 0,
}];
const PROGRESS_POSITIONS = generateRandomProgressPositions(100);

const Sparkles = ({
  className,
  style,
  ...presetSettings
}: OwnProps) => {
  if (presetSettings.preset === 'button') {
    return (
      <div className={buildClassName(styles.root, styles.button, className)} style={style}>
        {BUTTON_POSITIONS.map((position) => {
          const shiftX = Math.cos(Math.atan2(-50 + position.y, -50 + position.x)) * 100;
          const shiftY = Math.sin(Math.atan2(-50 + position.y, -50 + position.x)) * 100;
          return (
            <div
              className={styles.symbol}
              style={buildStyle(
                `top: ${position.y}%`,
                `left: ${position.x}%`,
                `--_duration-shift: ${(-position.durationShift / 100) * ANIMATION_DURATION}s`,
                `--_shift-x: ${shiftX}%`,
                `--_shift-y: ${shiftY}%`,
                `scale: ${position.size}%`,
              )}
            >
              {SYMBOL}
            </div>
          );
        })}
      </div>
    );
  }

  if (presetSettings.preset === 'progress') {
    return (
      <div className={buildClassName(styles.root, styles.progress, className)} style={style}>
        {PROGRESS_POSITIONS.map((position) => {
          return (
            <div
              className={styles.symbol}
              style={buildStyle(
                `top: ${position.y}%`,
                `left: ${position.x}%`,
                `--_shift-x: ${position.velocityX}%`,
                `--_shift-y: ${position.velocityY}%`,
                `scale: ${position.scale}%`,
                `--_duration-shift: ${(-position.durationShift / 100) * ANIMATION_DURATION}s`,
              )}
            >
              {SYMBOL}
            </div>
          );
        })}
      </div>
    );
  }

  return undefined;
};

function generateRandomProgressPositions(count: number) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      velocityX: (Math.random() * 5 + 15) * 100,
      velocityY: (Math.random() * 10 - 5) * 100,
      scale: (Math.random() * 0.5 + 0.5) * 100,
      durationShift: Math.random() * 100,
    });
  }
  return positions;
}

export default memo(Sparkles);
