import type { ApiMediaAreaCoordinates } from '../../../../api/types';

import { clamp, getSmoothStep, lerp } from '../../../../util/math';
import { getStickerPose, getStickerSide, STICKER_WIDTH_FRACTION } from './cardStickers';

// The motion of a sticker off the card, ported from the iOS app (`WalletGiftStickerCoordinator`). Times are in seconds,
// lengths in CSS pixels, which stand for the points of the iOS app.

export type MotionPose = {
  // Viewport pixels of the center
  x: number;
  y: number;
  side: number;
  // Radians
  angle: number;
  // 0 lies on the surface, 1 is raised with a full shadow
  lift: number;
  // The fold line as a share of the side from the top: 1 is flat, and a peel moves it from the bottom to the top
  front: number;
  // Radians the raised part turns to past the fold
  bend: number;
  shade: number;
  // 0 shows the bare art of a tile, 1 the die-cut sticker
  border: number;
  opacity: number;
  axisX: number;
  axisY: number;
  // Degrees around the axis
  tilt: number;
};

export type MotionSample = {
  time: number;
  x: number;
  y: number;
};

export type DragMotion = {
  original: MotionPose;
  start: number;
  isFromCard: boolean;
  x: number;
  y: number;
  angle: number;
  scale: number;
  samples: MotionSample[];
  isTwisting?: boolean;
  isReleased?: boolean;
};

export type FlightMotion = {
  from: MotionPose;
  start: number;
  // `fade` goes out of sight where the tile is not visible, and `settle` fades over the card that already shows it
  type: 'stick' | 'return' | 'fade' | 'settle';
  // Flies in an arc from a tile or the gift screen, instead of being released over the card
  isThrown?: boolean;
  isPeelFirst?: boolean;
  isFast?: boolean;
  // Sticks over the limit, then peels off and flies back
  isRejected?: boolean;
};

export type MotionSpring = {
  value: number;
  velocity: number;
  target: number;
  stiffness: number;
  // The damping ratio
  damping: number;
};

const CARRY_SCALE = 1.4;
const PEEL_DURATION = 0.3;
const RAISE_DELAY = 0.225;
const RAISE_DURATION = 0.26;
const MAX_BEND = 0.75;
// A tile's bare art takes the die-cut border before the peel ends
const PEEL_BORDER_SPEED = 1.3;

const VELOCITY_WINDOW = 0.12;
const MIN_VELOCITY_SPAN = 0.008;
const VELOCITY_FADE = 0.09;
const SWAY_PER_SPEED = 0.00035;
const MAX_SWAY = 0.25;
const TILT_PER_SPEED = 0.009;
const MAX_TILT = 14;

const CONTACT_DURATION = 0.18;
const THROW_CONTACT_DURATION = 0.5;
const STICK_DURATION = 0.42;
const FADE_DURATION = 0.3;
const REJECTED_HOLD = 0.6;
const RETURN_DURATION = 0.44;
const FAST_RETURN_DURATION = 0.32;
const PEEL_RETURN_DURATION = 0.5;
const HOME_LAY_DURATION = 0.4;
const OFFSCREEN_FADE_DURATION = 0.25;
const OFFSCREEN_FADE_SCALE = 0.6;

const THROW_MAX_BOW = 110;
const THROW_BOW_SHARE = 0.32;
const THROW_GROWTH = 0.12;
const THROW_LIFT = 0.9;
const THROW_TIP_START = 0.6;
// The arc of a throw rises by half the bow on its way
const THROW_RISE_SHARE = 0.5;
const THROW_BORDER_SPEED = 3;
const RETURN_MAX_ARC = 90;
const RETURN_ARC_SHARE = 0.28;
const RETURN_GROWTH = 0.05;
const RETURN_LIFT = 0.8;
const RETURN_TIP_START = 0.55;
const TILE_BUMP = 0.022;

const PLAY_RISE_DURATION = 0.22;
const PLAY_FALL_DURATION = 0.34;
const PLAY_FADE_DURATION = 0.14;
export const PLAY_GROWTH = 0.22;
export const PLAY_LIFT = 0.5;

const SPRING_STEP = 1 / 480;
const SPRING_REST = 0.002;
const SPRING_REST_VELOCITY = SPRING_REST * 10;

export function getMotionTime() {
  return performance.now() / 1000;
}

export function createMotionPose(
  pose: Pick<MotionPose, 'x' | 'y' | 'side' | 'angle'> & Partial<MotionPose>,
): MotionPose {
  return {
    lift: 0,
    front: 1,
    bend: 0,
    shade: 0,
    border: 1,
    opacity: 1,
    axisX: 0,
    axisY: 1,
    tilt: 0,
    ...pose,
  };
}

export function getCardMotionPose(coordinates: ApiMediaAreaCoordinates, faceRect: DOMRect) {
  const { x, y } = getStickerPose(coordinates);

  return createMotionPose({
    x: faceRect.left + x * faceRect.width,
    y: faceRect.top + y * faceRect.height,
    side: getStickerSide(coordinates, faceRect),
    angle: (coordinates.rotation * Math.PI) / 180,
  });
}

export function getRectMotionPose({
  left, top, width, height,
}: DOMRect) {
  return createMotionPose({
    x: left + width / 2, y: top + height / 2, side: width, angle: 0, border: 0,
  });
}

// Only the place, size, angle and opacity go between the poses; the rest starts over, as in the iOS app
export function mixMotionPoses(from: MotionPose, to: MotionPose, t: number) {
  return createMotionPose({
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    side: lerp(from.side, to.side, t),
    angle: lerp(from.angle, to.angle, t),
    opacity: lerp(from.opacity, to.opacity, t),
  });
}

export function addMotionSample(samples: MotionSample[], sample: MotionSample) {
  return samples.filter(({ time }) => sample.time - time <= VELOCITY_WINDOW).concat(sample);
}

// Pixels per second over the last samples, fading once the pointer stops
export function getMotionVelocity(samples: MotionSample[], now: number) {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || last.time - first.time <= MIN_VELOCITY_SPAN) return { x: 0, y: 0 };

  const span = last.time - first.time;
  const fade = Math.exp(-Math.max(0, now - last.time) / VELOCITY_FADE);

  return { x: ((last.x - first.x) / span) * fade, y: ((last.y - first.y) / span) * fade };
}

export function getDragPose(drag: DragMotion, now: number, cardWidth: number) {
  const elapsed = now - drag.start;
  const peel = getSmoothStep(elapsed / PEEL_DURATION);
  const raise = getSmoothStep((elapsed - RAISE_DELAY) / RAISE_DURATION);
  const side = cardWidth * STICKER_WIDTH_FRACTION * drag.scale * CARRY_SCALE;
  const pose = mixMotionPoses(drag.original, createMotionPose({
    x: drag.x, y: drag.y, side, angle: drag.angle,
  }), raise);

  if (!drag.isTwisting) {
    const velocity = getMotionVelocity(drag.samples, now);
    const speed = Math.hypot(velocity.x, velocity.y);

    pose.angle += clamp(velocity.x * SWAY_PER_SPEED, -MAX_SWAY, MAX_SWAY) * raise;
    pose.tilt = Math.min(MAX_TILT, speed * TILT_PER_SPEED) * raise;
    if (speed > 1) {
      pose.axisX = -velocity.y / speed;
      pose.axisY = velocity.x / speed;
    }
  }

  pose.border = drag.isFromCard ? 1 : Math.min(1, peel * PEEL_BORDER_SPEED);
  pose.lift = raise;
  pose.front = 1 - peel;
  pose.bend = MAX_BEND * (1 - raise);
  pose.shade = 1 - raise;

  return pose;
}

export function getIsDragMotionResting(drag: DragMotion, now: number) {
  if (!drag.isReleased || now - drag.start < Math.max(PEEL_DURATION, RAISE_DELAY + RAISE_DURATION)) return false;

  const velocity = getMotionVelocity(drag.samples, now);

  return Math.hypot(velocity.x, velocity.y) <= 1;
}

export function getFlightContact({ isThrown }: FlightMotion) {
  return isThrown ? THROW_CONTACT_DURATION : CONTACT_DURATION;
}

// The moment the card takes the sticker back from the flight
export function getFlightHandOff(flight: FlightMotion) {
  return getFlightContact(flight) + STICK_DURATION;
}

export function getFlightDuration(flight: FlightMotion) {
  if (flight.type === 'stick') {
    return getFlightHandOff(flight) + (flight.isRejected ? REJECTED_HOLD : FADE_DURATION);
  }

  if (flight.type === 'return') {
    const { lead, travel } = getReturnTiming(flight);
    return lead + travel + HOME_LAY_DURATION;
  }

  return flight.type === 'settle' ? FADE_DURATION : OFFSCREEN_FADE_DURATION;
}

// `target` is the live pose of the sticker on the card, or of the model in its tile
export function getFlightPose(flight: FlightMotion, elapsed: number, target: MotionPose) {
  if (flight.type === 'stick') return getStickPose(flight, elapsed, target);
  if (flight.type === 'return') return getReturnPose(flight, elapsed, target);
  if (flight.type === 'settle') return { ...flight.from, opacity: 1 - getSmoothStep(elapsed / FADE_DURATION) };

  // The tile is out of sight: the sticker shrinks where it is and fades out
  const t = Math.min(1, elapsed / OFFSCREEN_FADE_DURATION);
  const pose = mixMotionPoses(flight.from, { ...flight.from, side: flight.from.side * OFFSCREEN_FADE_SCALE }, t);
  pose.opacity = 1 - t;

  return pose;
}

export function getTileBumpScale(flight: FlightMotion, elapsed: number) {
  const { lead, travel } = getReturnTiming(flight);
  const lay = clamp((elapsed - lead - travel) / HOME_LAY_DURATION, 0, 1);

  return 1 - TILE_BUMP * Math.sin(Math.PI * lay);
}

function getStickPose(flight: FlightMotion, elapsed: number, live: MotionPose) {
  const { from, isThrown, isRejected } = flight;
  const contact = getFlightContact(flight);
  // The sticker turns the short way to its angle on the card
  const target = {
    ...live,
    angle: from.angle + Math.atan2(Math.sin(live.angle - from.angle), Math.cos(live.angle - from.angle)),
  };
  const progress = Math.min(1, elapsed / contact);
  const eased = isThrown ? 1 - (1 - progress) ** 3 : getSmoothStep(elapsed / contact);
  const pose = mixMotionPoses(from, target, eased);

  if (isThrown) {
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const direction = dx >= 0 ? -1 : 1;
    const bow = Math.min(THROW_MAX_BOW, length * THROW_BOW_SHARE);
    const arc = Math.sin(Math.PI * progress);
    const tip = getSmoothStep((progress - THROW_TIP_START) / (1 - THROW_TIP_START));

    pose.x += (-dy / length) * bow * direction * arc;
    pose.y += ((dx / length) * bow * direction - bow * THROW_RISE_SHARE) * arc;
    pose.side *= 1 + THROW_GROWTH * arc;
    pose.border = Math.min(1, progress * THROW_BORDER_SPEED);
    pose.lift = THROW_LIFT * arc;
    pose.bend = MAX_BEND * tip;
    pose.shade = tip;
  } else {
    pose.border = from.border + (1 - from.border) * eased;
    pose.tilt = from.tilt * (1 - eased);
    pose.axisX = from.axisX;
    pose.axisY = from.axisY;
    pose.lift = from.lift * (1 - eased);
    pose.bend = MAX_BEND * eased;
    pose.shade = eased;
  }

  // The fold sweeps from the top to the bottom and presses the sticker down
  pose.front = getSmoothStep((elapsed - contact) / STICK_DURATION);
  if (elapsed >= contact + STICK_DURATION) {
    pose.bend = 0;
    pose.shade = 0;
  }

  if (!isRejected && elapsed > contact + STICK_DURATION) {
    pose.opacity = 1 - getSmoothStep((elapsed - contact - STICK_DURATION) / FADE_DURATION);
  }

  return pose;
}

function getReturnPose(flight: FlightMotion, elapsed: number, target: MotionPose) {
  const { from, isPeelFirst } = flight;
  const { lead, travel } = getReturnTiming(flight);
  const landed = elapsed - lead - travel;

  if (landed >= 0) {
    const lay = getSmoothStep(landed / HOME_LAY_DURATION);
    const pose = { ...target };

    pose.border = from.border * (1 - getSmoothStep((lay - RETURN_TIP_START) / (1 - RETURN_TIP_START)));
    pose.front = lay;
    pose.bend = lay < 1 ? MAX_BEND : 0;
    pose.shade = lay < 1 ? 1 - lay : 0;

    return pose;
  }

  const progress = clamp((elapsed - lead) / travel, 0, 1);
  const eased = isPeelFirst ? easeInOutQuad(progress) : 1 - (1 - progress) ** 2;
  const distance = Math.hypot(target.x - from.x, target.y - from.y);
  // A quadratic curve through a point raised over the middle
  const controlX = (from.x + target.x) / 2;
  const controlY = (from.y + target.y) / 2 - Math.min(RETURN_MAX_ARC, distance * RETURN_ARC_SHARE);
  const rest = 1 - eased;
  const arc = Math.sin(Math.PI * eased);
  const pose = mixMotionPoses(from, target, eased);

  pose.x = rest * rest * from.x + 2 * rest * eased * controlX + eased * eased * target.x;
  pose.y = rest * rest * from.y + 2 * rest * eased * controlY + eased * eased * target.y;
  pose.side *= 1 + RETURN_GROWTH * arc;
  pose.angle = from.angle * (1 - eased);
  pose.lift = RETURN_LIFT * arc;
  pose.border = from.border;

  const raise = getSmoothStep((elapsed - lead) / RAISE_DURATION);
  if (isPeelFirst && raise < 1) {
    pose.front = 1 - getSmoothStep(elapsed / PEEL_DURATION);
    pose.bend = MAX_BEND * (1 - raise);
    pose.shade = 1 - raise;
  } else {
    const tip = getSmoothStep((progress - RETURN_TIP_START) / (1 - RETURN_TIP_START));
    pose.front = 0;
    pose.bend = MAX_BEND * tip;
    pose.shade = tip;
  }

  return pose;
}

// The standard quadratic ease-in-out
function easeInOutQuad(value: number) {
  return value < 0.5 ? 2 * value * value : 1 - 2 * (1 - value) ** 2;
}

function getReturnTiming({ isPeelFirst, isFast }: FlightMotion) {
  return {
    lead: isPeelFirst ? RAISE_DELAY : 0,
    travel: isPeelFirst ? PEEL_RETURN_DURATION : isFast ? FAST_RETURN_DURATION : RETURN_DURATION,
  };
}

export function getPlayRise(elapsed: number, endElapsed?: number) {
  return endElapsed === undefined
    ? getSmoothStep(elapsed / PLAY_RISE_DURATION)
    : 1 - getSmoothStep((elapsed - endElapsed) / PLAY_FALL_DURATION);
}

export function getPlayOpacity(elapsed: number, endElapsed?: number) {
  const fadeIn = Math.min(1, elapsed / PLAY_FADE_DURATION);
  const fadeOut = endElapsed === undefined ? 1 : (PLAY_FALL_DURATION - (elapsed - endElapsed)) / PLAY_FADE_DURATION;

  return Math.max(0, Math.min(fadeIn, fadeOut));
}

export function getIsPlayOver(elapsed: number, endElapsed?: number) {
  return endElapsed !== undefined && elapsed - endElapsed >= PLAY_FALL_DURATION;
}

export function createMotionSpring(value: number, stiffness: number, damping: number): MotionSpring {
  return {
    value, velocity: 0, target: value, stiffness, damping,
  };
}

// Semi-implicit Euler in small steps, as in the iOS app
export function stepMotionSpring(spring: MotionSpring, dt: number) {
  const friction = 2 * spring.damping * Math.sqrt(spring.stiffness);

  for (let left = dt; left > 0; left -= SPRING_STEP) {
    const step = Math.min(left, SPRING_STEP);
    spring.velocity += (-spring.stiffness * (spring.value - spring.target) - friction * spring.velocity) * step;
    spring.value += spring.velocity * step;
  }
}

export function getIsMotionSpringResting({ value, target, velocity }: MotionSpring) {
  return Math.abs(value - target) < SPRING_REST && Math.abs(velocity) < SPRING_REST_VELOCITY;
}
