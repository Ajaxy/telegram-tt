import {
  ease, FRAME_DURATION, pulse, sampleFrames,
} from './motion';
import { SPIN_DURATION } from './roll';

const REFUSAL_SHIFT_PX = 9;
const REFUSAL_FRAME_COUNT = 13;
const REFUSAL_HALF_WAVES = 6;
const FLIP_ANGLE = 180;
const FLIP_DROP = 16;
const FLIP_BLUR = 6;
const FLIP_TILT = 20;
const FLIP_TILT_DELAY = 300;
const FLIP_TILT_FREQUENCY = 1.6;
const FLIP_TILT_DECAY = 500;
const POP_SIZE = 0.14;
const ARROW_TRAVEL = 22;
const ARROW_STRETCH = 0.55;
const ARROW_BLUR = 2.5;
const ARROW_PACE_EXPONENT = 1.2;
const ARROW_LOOP_POINT = 0.5;

export const REFUSAL_DURATION_MS = 420;
export const REFUSAL_VIBRATION = [12, 60, 10];
export const FLIP_DURATION = 1900;
export const POP_DURATION = 420;
export const REFUSAL_FRAMES = buildRefusalFrames();
export const FLIP_FRAMES_TO_FIAT = buildFlipFrames(false);
export const FLIP_FRAMES_TO_GEM = buildFlipFrames(true);
export const ARROW_UP_FRAMES = buildArrowFrames(-1);
export const ARROW_DOWN_FRAMES = buildArrowFrames(1);
export const POP_FRAMES = sampleFrames(POP_DURATION, (time) => ({ scale: String(1 + POP_SIZE * getPop(time)) }));

export function getPop(time: number) {
  return time < 0 || time >= POP_DURATION ? 0 : pulse(time / POP_DURATION);
}

function buildRefusalFrames(): Keyframe[] {
  return Array.from({ length: REFUSAL_FRAME_COUNT }, (_, i) => {
    const progress = i / (REFUSAL_FRAME_COUNT - 1);
    const shift = REFUSAL_SHIFT_PX * Math.sin(progress * Math.PI * REFUSAL_HALF_WAVES) * (1 - progress);

    return { translate: `${shift}px 0` };
  });
}

function buildFlipFrames(isToGem: boolean) {
  return {
    gem: sampleFrames(FLIP_DURATION, (time) => getFlipFrame(time, isToGem)),
    sign: sampleFrames(FLIP_DURATION, (time) => getFlipFrame(time, !isToGem)),
  };
}

function getFlipFrame(time: number, isArriving: boolean): Keyframe {
  const progress = ease(time / SPIN_DURATION);
  const size = 1 + POP_SIZE * getPop(time);
  const filter = `blur(${FLIP_BLUR * Math.sin(Math.PI * progress)}px)`;
  if (!isArriving) {
    return {
      transform: `translateY(${FLIP_DROP * progress}px) rotateY(${FLIP_ANGLE * progress}deg) scale(${size})`,
      filter,
    };
  }

  const swingTime = Math.max(time - FLIP_TILT_DELAY, 0);
  const swing = FLIP_TILT * Math.sin((2 * Math.PI * FLIP_TILT_FREQUENCY * swingTime) / 1000)
    * Math.exp(-swingTime / FLIP_TILT_DECAY);

  return {
    transform: `translateY(${FLIP_DROP * (1 - progress)}px) rotateY(${FLIP_ANGLE * (progress - 1)}deg) `
      + `rotateZ(${swing}deg) scale(${size})`,
    filter,
  };
}

// Each arrow leaves past its edge, comes back from the opposite one and stretches with its speed
function buildArrowFrames(direction: number): Keyframe[] {
  const count = Math.ceil(SPIN_DURATION / FRAME_DURATION);
  const frames: Keyframe[] = [];

  for (let i = 0; i <= count; i++) {
    const progress = ease(i / count);
    const pace = (1 - i / count) ** ARROW_PACE_EXPONENT;
    const loop = (progress < ARROW_LOOP_POINT ? progress : progress - 1) / ARROW_LOOP_POINT;
    const frame = {
      offset: i / count,
      transform: `translateY(${direction * ARROW_TRAVEL * loop}px) scaleY(${1 + ARROW_STRETCH * pace})`,
      filter: `blur(${(ARROW_BLUR * pace * pace).toFixed(2)}px)`,
    };

    const previous = frames[frames.length - 1];
    if (previous && progress >= ARROW_LOOP_POINT && ease((i - 1) / count) < ARROW_LOOP_POINT) {
      frames.push({ ...previous, offset: frame.offset }, {
        ...frame, transform: `translateY(${-direction * ARROW_TRAVEL}px) scaleY(${1 + ARROW_STRETCH * pace})`,
      });
    }
    frames.push(frame);
  }

  return frames;
}
