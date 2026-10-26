import { clamp, lerp } from '../../util/math';

import modelUrl from '../../assets/models/diamond/model.bin?url&no-inline';

export type DiamondPalette = 'regular' | 'white' | 'icon';

export type DiamondViewport = {
  x: number;
  y: number;
  size: number;
};

export type DiamondDrawState = {
  lastYaw?: number;
  lastTilt?: number;
};

type DiamondModel = {
  vertices: Float32Array;
  mainSparkle: Float32Array;
  smallSparkles: Float32Array;
  frames: Float32Array;
  planes: Float32Array;
  anchors: Float32Array;
  widths: Float32Array;
  facetProjection: Float32Array;
  camera: Float32Array;
};

// What the shaders take for one frame
export type DiamondPose = {
  // The animation frame, interpolated: the sweeps of light, then the sparkle shape
  frame: Float32Array;
  modelMatrix: Float32Array;
  inverseModelMatrix: Float32Array;
  projection: Float32Array;
  anchor: number;
  widthScale: number;
  sparkleVisibility: number;
};

export const VEC4_SIZE = 4;
export const FLOAT_SIZE = 4;
export const DIAMOND_ATTRIBUTE_COUNT = 3;
export const SPARKLE_ATTRIBUTE_COUNT = 2;

// As the apps pass them: the large diamond keeps the model colors, the wallet card has the icy white one of the iOS
// app, the chat icon is blue with a white glow
export const PALETTE_IDS: Record<DiamondPalette, number> = {
  regular: 0,
  white: 1,
  icon: 2,
};

export const SPARKLE_SHAPE_OFFSET = 36;
export const SPARKLE_HALO_SCALE_INDEX = 40;

export const PLANE_COUNT = 17;
export const REFRACTION = 0.72;
const SPARKLE_ANCHOR_COUNT = 8;
export const SMALL_SPARKLE_COUNT = 7;

export const TURN_DURATION = 10.54;

const MATRIX_SIZE = 16;
const FRAME_SIZE = 42;
const FRAMES_PER_SECOND = 240;
// The file holds one more frame, a copy of the first, so the last frame interpolates into it
const FRAME_COUNT = 1440;

// The projection is fitted to a cut 0.9975 wide face on; a cut of another width is scaled to the same size
const PROJECTION_SCALE = 1.52;
const PROJECTION_BASE_WIDTH = 0.9975;
const PROJECTION_DEPTH = 6;
const PROJECTION_CENTER_DEPTH = 0.5;
const PROJECTION_SHIFT = 0.12;

// The camera file holds the tilt of the view, the camera distance and the depth scale
const CAMERA_LENGTH = 3;
// A squeeze keeps the width steady while the diamond turns; the table covers 0..45° in half-degree steps
const WIDTH_STEPS = 90;
const WIDTH_STEPS_PER_RADIAN = 360 / Math.PI;
const WIDTH_DIP = 0.035;
const WIDTH_FADE_START = Math.sin(0.25);
const WIDTH_FADE_END = Math.sin(0.96);
const QUARTER_TURN = Math.PI / 2;

// The main sparkle sits on the side face facing the viewer the most, at one of the model's anchor points
const FACE_COUNT = 4;
// The main sparkle fades out when its facet turns away by more than `FACING_ANGLE` and while the diamond spins fast
const FACING_ANGLE = Math.PI / 15;
const CALM_SPEED = Math.PI * (2 / 15);
const CALM_START = 0.06;
const CALM_RANGE = 0.34;
const MIN_SPEED = 0.001;
const INITIAL_SPEED = 0.596;

const DEFAULT_FRAME_TIME = 1 / 60;
const MAX_FRAME_TIME = 0.1;

const MODEL_PART_COUNT = 9;

let modelPromise: Promise<DiamondModel> | undefined;

// Capped at `MAX_FRAME_TIME`, so after a stall the diamond moves on by one short step instead of jumping ahead
export function getFrameTime(now: number, lastFrameTime?: number) {
  return lastFrameTime === undefined ? DEFAULT_FRAME_TIME : Math.min(MAX_FRAME_TIME, (now - lastFrameTime) / 1000);
}

export function loadModel() {
  if (!modelPromise) {
    modelPromise = fetchModel();

    modelPromise.catch(() => {
      modelPromise = undefined;
    });
  }

  return modelPromise;
}

// One file with nine parts: a header of their lengths in floats, then the floats of each part in turn
async function fetchModel(): Promise<DiamondModel> {
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Cannot load ${modelUrl}`);

  const buffer = await response.arrayBuffer();
  const lengths = new Uint32Array(buffer, 0, MODEL_PART_COUNT);
  let offset = lengths.byteLength;
  const [vertices, mainSparkle, smallSparkles, frames, planes, anchors, widths, facetProjection, camera] = Array
    .from(lengths, (length) => {
      const part = new Float32Array(buffer, offset, length);
      offset += part.byteLength;

      return part;
    });

  if (frames.length !== (FRAME_COUNT + 1) * FRAME_SIZE
    || planes.length !== PLANE_COUNT * VEC4_SIZE
    || anchors.length !== SPARKLE_ANCHOR_COUNT * 2 * VEC4_SIZE
    || widths.length !== WIDTH_STEPS + 1
    || facetProjection.length !== VEC4_SIZE
    || camera.length !== CAMERA_LENGTH) {
    throw new Error('Unexpected diamond model data');
  }

  return {
    vertices, mainSparkle, smallSparkles, frames, planes, anchors, widths, facetProjection, camera,
  };
}

// Angles are in radians, times in seconds of the scene clock. The returned pose is reused by the next call.
export function createPoseSolver({ frames, widths, camera }: DiamondModel) {
  const [cameraTilt] = camera;
  const projection = buildProjection(1, camera, widths[0]);
  const horizontalScale = projection[0];
  const pose: DiamondPose = {
    frame: new Float32Array(FRAME_SIZE),
    modelMatrix: new Float32Array(MATRIX_SIZE),
    inverseModelMatrix: new Float32Array(MATRIX_SIZE),
    projection,
    anchor: 0,
    widthScale: 1,
    sparkleVisibility: 0,
  };

  function interpolateFrame(time: number) {
    const position = (time * FRAMES_PER_SECOND) % FRAME_COUNT;
    const index = Math.floor(position);
    const fraction = position - index;
    const offset = index * FRAME_SIZE;

    for (let i = 0; i < FRAME_SIZE; i++) {
      pose.frame[i] = lerp(frames[offset + i], frames[offset + FRAME_SIZE + i], fraction);
    }
  }

  function updateModel(tilt: number, turn: number) {
    const sinTilt = Math.sin(tilt);
    const cosTilt = Math.cos(tilt);
    const sinTurn = Math.sin(turn);
    const cosTurn = Math.cos(turn);

    // A pure rotation is orthogonal, so its inverse is its transpose
    pose.modelMatrix.set([
      cosTurn, sinTilt * sinTurn, -cosTilt * sinTurn, 0,
      0, cosTilt, sinTilt, 0,
      sinTurn, -sinTilt * cosTurn, cosTilt * cosTurn, 0,
      0, 0, 0, 1,
    ]);

    pose.inverseModelMatrix.set([
      cosTurn, 0, sinTurn, 0,
      sinTilt * sinTurn, cosTilt, -sinTilt * cosTurn, 0,
      -cosTilt * sinTurn, sinTilt, cosTilt * cosTurn, 0,
      0, 0, 0, 1,
    ]);
  }

  return function solvePose(state: DiamondDrawState, time: number, frameTime: number, yaw: number, pitch: number) {
    interpolateFrame(time);

    const pitchCos = Math.cos(pitch);
    const tilt = pitch + cameraTilt;
    updateModel(tilt, yaw);

    pose.widthScale = getWidthScale(yaw, tilt, widths);
    projection[0] = horizontalScale * pose.widthScale;

    let maxFacing = -1;

    for (let i = 0; i < FACE_COUNT; i++) {
      const angle = (i * 2 * Math.PI) / FACE_COUNT;
      const facing = pitchCos * Math.cos(yaw + angle);

      if (facing > maxFacing) {
        maxFacing = facing;
        pose.anchor = angle;
      }
    }

    const { lastYaw, lastTilt } = state;
    const speed = lastYaw === undefined || lastTilt === undefined || frameTime <= 0
      ? INITIAL_SPEED
      : Math.hypot(Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw)), tilt - lastTilt) / frameTime;

    state.lastYaw = yaw;
    state.lastTilt = tilt;

    const facingRatio = clamp(1 - Math.acos(clamp(maxFacing, -1, 1)) / FACING_ANGLE, 0, 1);
    const calmRatio = clamp((CALM_SPEED / Math.max(speed, MIN_SPEED) - CALM_START) / CALM_RANGE, 0, 1);
    pose.sparkleVisibility = interpolateSmoothly(calmRatio) * interpolateSmoothly(facingRatio);

    return pose;
  };
}

// Keeps depth in 0..1, as the shaders from the Metal renderer expect; the first value is the horizontal scale
function buildProjection(aspectRatio: number, camera: Float32Array, faceOnWidth: number) {
  const [, cameraDistance, cameraScale] = camera;
  const scale = Math.max(1, 1 / aspectRatio) * PROJECTION_SCALE * (faceOnWidth / PROJECTION_BASE_WIDTH);
  const depthScale = 1 / cameraScale;
  const perspective = -depthScale / cameraDistance;
  const shift = PROJECTION_SHIFT / scale;

  return new Float32Array([
    1 / (aspectRatio * scale), 0, 0, 0,
    0, 1 / scale, 0, 0,
    0, shift * perspective, -depthScale / PROJECTION_DEPTH, perspective,
    0, shift * depthScale, PROJECTION_CENTER_DEPTH * depthScale, depthScale,
  ]);
}

function getWidthScale(yaw: number, tilt: number, widths: Float32Array) {
  const angle = Math.abs(yaw - Math.round(yaw / QUARTER_TURN) * QUARTER_TURN);
  const position = Math.min(WIDTH_STEPS, angle * WIDTH_STEPS_PER_RADIAN);
  const index = Math.min(WIDTH_STEPS - 1, Math.floor(position));
  const width = interpolateCubic(widths, index, position - index);
  const targetWidth = (1 - WIDTH_DIP * Math.sin(2 * angle) ** 2) * widths[0];
  const fade = interpolateSmoothly(
    clamp((Math.abs(Math.sin(tilt)) - WIDTH_FADE_START) / (WIDTH_FADE_END - WIDTH_FADE_START), 0, 1),
  );

  return 1 + (1 - fade) * (targetWidth / width - 1);
}

// A Catmull-Rom spline through the table, with flat ends
function interpolateCubic(values: Float32Array, index: number, t: number) {
  const from = values[index];
  const to = values[index + 1];
  const fromSlope = index === 0 ? 0 : (to - values[index - 1]) / 2;
  const toSlope = index + 2 >= values.length ? 0 : (values[index + 2] - from) / 2;

  return ((((from - to) * 2 + fromSlope + toSlope) * t + ((to - from) * 3 - fromSlope * 2 - toSlope)) * t
    + fromSlope) * t + from;
}

function interpolateSmoothly(x: number) {
  return x * x * (3 - 2 * x);
}
