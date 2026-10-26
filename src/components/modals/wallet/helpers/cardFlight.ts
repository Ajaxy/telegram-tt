import { clamp, lerp } from '../../../../util/math';

// The card view of the iOS app (`PeerWalletScreen.applyProgress`): each frame is a function of progress from 0 to 1.
// The card is pulled out of a slot at the middle of the balance pill, tilted back and turned sideways, then flies to
// its place and rings there.

type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CardFlightGeometry = {
  // The resting frame of the card on screen
  card: Rect;
  pill: Rect;
  buttonTop: number;
  screenHeight: number;
};

export type CardFlightFrame = {
  offsetX: number;
  offsetY: number;
  opacity: number;
  transform: string;
  // The slot line in the card box: only what is below it shows
  slotEdge?: number;
  // How far the label of the pill has rolled up
  shutter: number;
  buttonOffset: number;
};

type Motion = {
  start: number;
  arrival: number;
  hold?: number;
};

type Pose = {
  pitch: number;
  yaw: number;
  roll: number;
  scale: number;
};

type Point = {
  x: number;
  y: number;
};

export const OPEN_DURATION = 790;
export const FADE_OPEN_DURATION = 650;
export const CLOSE_DURATION = 300;
export const FADE_CLOSE_DURATION = 150;

const OPEN_IMPACT = 0.5;
const RING_RATE = 14;
const RING_DAMPING = 6;
const TAIL_START = 0.88;
const TAIL_DURATION = 0.12;
const MIN_CAMERA_DISTANCE = 280;
const CAMERA_DISTANCE_RATIO = 1.2;
const SLOT_PITCH = (50 * Math.PI) / 180;
const SLOT_WIDTH_SHARE = 0.45;
const SLOT_CLEARANCE = 4;
const YAW_PER_VELOCITY = (9 * Math.PI) / 180;
const SIDEWAYS_SHIFT = 0.055;
const STRADDLING_SIDEWAYS_HOLD = 0.6;
const SIDEWAYS_HOLD = 0.45;
const VELOCITY_STEP = 0.004;
const VELOCITY_SCALE = 1.5;
const TWIST_LEAD = 0.05;
const TWIST_SPAN = 0.3;
const MIN_TRAVEL = 0.001;
const MIN_PERSPECTIVE_DIVISOR = 0.001;
const OPEN_PEAK = 0.6;
const CLOSE_PEAK = 0.42;
const FALL_SPAN = 0.8;
const CLOSE_MASK_END = 0.75;
const FADE_IN_END = 0.045;
const OPEN_SHUTTER_END = 0.3;
const CLOSE_SHUTTER_END = 0.4;
const BUTTON_DELAY = 0.06;
const BUTTON_GAP = 8;
const FADE_BUTTON_END = 0.77;

const TRAVEL: Motion = { start: 1.2, arrival: 0.16, hold: 0.1 };
const PITCH: Motion = { start: 0, arrival: 0.16, hold: 0.38 };
const ROLL: Motion = { start: 0, arrival: 0.18, hold: 0.4 };
const GROWTH: Motion = { start: 0, arrival: 0.13, hold: 0.4 };
const BUTTON: Motion = { start: 2.4, arrival: 0.25 };

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

export function getCardFlightFrame(
  progress: number, geometry: CardFlightGeometry, isDismissing?: boolean,
): CardFlightFrame {
  const { card, pill } = geometry;
  const p = clamp(progress, 0, 1);
  const impact = isDismissing ? 1 : OPEN_IMPACT;
  const tail = 1 - smooth((p - TAIL_START) / TAIL_DURATION);
  const fly = (time: number, motion: Motion) => getFlightValue(time, motion, impact, tail, isDismissing);

  const halfWidth = card.width / 2;
  const halfHeight = card.height / 2;
  const cardX = card.left + halfWidth;
  const cardY = card.top + halfHeight;
  const pillX = pill.left + pill.width / 2;
  const slotLine = pill.top + pill.height / 2;
  const camera = Math.max(MIN_CAMERA_DISTANCE, card.width * CAMERA_DISTANCE_RATIO);
  const project = (pose: Pose) => projectCorners(pose, halfWidth, halfHeight, camera, tail);

  const slotScale = Math.min(1, pill.width / Math.max(1, card.height));
  const slotReach = Math.max(...project({
    pitch: SLOT_PITCH, yaw: 0, roll: -Math.PI / 2, scale: slotScale,
  }).map(({ x }) => Math.abs(x)));
  const startScale = slotScale * Math.min(1, (pill.width * SLOT_WIDTH_SHARE) / Math.max(1, slotReach));
  const sidewaysHold = card.top < slotLine && !isDismissing ? STRADDLING_SIDEWAYS_HOLD : SIDEWAYS_HOLD;

  const getPose = (time: number) => {
    const travel = fly(time, TRAVEL);
    const twist = smooth((time / impact - sidewaysHold + TWIST_LEAD) / TWIST_SPAN);
    const slope = (fly(time + VELOCITY_STEP, TRAVEL) - fly(time - VELOCITY_STEP, TRAVEL)) / (2 * VELOCITY_STEP);
    const velocity = slope * (impact / VELOCITY_SCALE) * twist;

    return {
      pitch: SLOT_PITCH * (1 - fly(time, PITCH)),
      yaw: velocity * YAW_PER_VELOCITY,
      roll: -(1 - fly(time, ROLL)) * (Math.PI / 2),
      scale: lerp(startScale, 1, fly(time, GROWTH)),
      travel,
      sideTravel: fly(time, { start: 0, arrival: 0.16, hold: sidewaysHold }),
      velocity,
    };
  };
  // At the start of the travel the lowest point of the card sits on the slot line, so all of it is still inside
  const getCenterY = (corners: Point[], travel: number) => {
    const startY = slotLine - Math.max(...corners.map(({ y }) => y));
    return lerp(startY, cardY, travel);
  };

  // A card resting over the slot dips below it on the way, so it never crosses the slot line again
  const peak = isDismissing ? CLOSE_PEAK : OPEN_PEAK * impact;
  const peakPose = getPose(peak);
  const peakCorners = project(peakPose);
  const peakTop = getCenterY(peakCorners, peakPose.travel) + Math.min(...peakCorners.map(({ y }) => y));
  const clearance = Math.max(0, slotLine + getSlotFeather(pill) + SLOT_CLEARANCE - peakTop);

  const pose = getPose(p);
  const peakTravel = Math.max(MIN_TRAVEL, peakPose.travel);
  let dip: number;
  if (p < peak) {
    dip = pose.travel / peakTravel;
  } else {
    const fallSpan = isDismissing ? 1 - peak : FALL_SPAN * impact;
    const peakSlope = (getPose(peak + VELOCITY_STEP).travel - getPose(peak - VELOCITY_STEP).travel)
      / (2 * VELOCITY_STEP) / peakTravel;
    const t = Math.min(1, (p - peak) / fallSpan);
    dip = (2 * t ** 3 - 3 * t ** 2 + 1) + (t ** 3 - 2 * t ** 2 + t) * peakSlope * fallSpan;
  }

  const centerX = lerp(pillX, cardX, pose.sideTravel) + card.width * SIDEWAYS_SHIFT * pose.velocity;
  const centerY = getCenterY(project(pose), pose.travel) + clearance * dip;
  const shouldMaskSlot = p < (clearance > 0 ? peak : (isDismissing ? CLOSE_MASK_END : impact));
  const buttonProgress = fly(p - (isDismissing ? 0 : BUTTON_DELAY), BUTTON);

  return {
    offsetX: centerX - cardX,
    offsetY: centerY - cardY,
    opacity: smooth(p / FADE_IN_END),
    transform: buildTransform(pose, camera, tail),
    slotEdge: shouldMaskSlot ? halfHeight + slotLine - centerY : undefined,
    shutter: pill.height * smooth(p / (isDismissing ? CLOSE_SHUTTER_END : OPEN_SHUTTER_END)),
    buttonOffset: getButtonDrop(geometry) * (1 - buttonProgress),
  };
}

export function getCardFadeFrame(progress: number, geometry: CardFlightGeometry): CardFlightFrame {
  const p = clamp(progress, 0, 1);

  return {
    offsetX: 0,
    offsetY: 0,
    opacity: p,
    transform: 'none',
    shutter: 0,
    buttonOffset: getButtonDrop(geometry) * (1 - Math.min(1, p / FADE_BUTTON_END)) ** 3,
  };
}

// A cubic curve from 0 to 1 with the given slopes, which starts after `hold` and arrives at `impact`. After that the
// value rings around 1 and calms down, unless the card is leaving.
export function getFlightValue(
  time: number, { start, arrival, hold = 0 }: Motion, impact: number, tail: number, isDismissing?: boolean,
) {
  const endSlope = isDismissing ? 0 : arrival;
  const holdTime = hold * impact;
  if (time < impact) {
    const t = Math.max(0, time - holdTime) / (impact - holdTime);
    return (t ** 3 - 2 * t ** 2 + t) * start + (3 * t ** 2 - 2 * t ** 3) + (t ** 3 - t ** 2) * endSlope;
  }

  const elapsed = time - impact;
  return 1 + (endSlope / ((impact - holdTime) * RING_RATE))
    * Math.exp(-RING_DAMPING * elapsed) * Math.sin(RING_RATE * elapsed) * tail;
}

// The far edge fades in over the lower half of the pill, so the card shows through the pill as it comes out.
// iOS fades it over 30pt below the slot, and through a translucent pill the card then seems to start under it.
export function getSlotFeather(pill: Rect) {
  return pill.height / 2;
}

export function smooth(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

// The transform order of `buildTransform`, applied to the corners of the card around its center
function projectCorners(pose: Pose, halfWidth: number, halfHeight: number, camera: number, tail: number): Point[] {
  const {
    pitch, yaw, roll, scale,
  } = pose;

  return CORNERS.map(([signX, signY]) => {
    const x0 = signX * halfWidth * scale;
    const y0 = signY * halfHeight * scale;
    const x1 = x0 * Math.cos(roll) - y0 * Math.sin(roll);
    const y1 = x0 * Math.sin(roll) + y0 * Math.cos(roll);
    const x2 = x1 * Math.cos(yaw);
    const z2 = -x1 * Math.sin(yaw);
    const y3 = y1 * Math.cos(pitch) - z2 * Math.sin(pitch);
    const z3 = y1 * Math.sin(pitch) + z2 * Math.cos(pitch);
    const w = Math.max(MIN_PERSPECTIVE_DIVISOR, 1 - (z3 * tail) / camera);

    return { x: x2 / w, y: y3 / w };
  });
}

function buildTransform({
  pitch, yaw, roll, scale,
}: Pose, camera: number, tail: number) {
  const perspective = tail > 0 ? `perspective(${camera / tail}px) ` : '';

  return `${perspective}rotateX(${pitch}rad) rotateY(${yaw}rad) rotateZ(${roll}rad) scale(${scale})`;
}

function getButtonDrop({ screenHeight, buttonTop }: CardFlightGeometry) {
  return screenHeight - buttonTop + BUTTON_GAP;
}
