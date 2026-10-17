import type { ElementRef } from '../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import { useStateRef } from '../../hooks/useStateRef';

import styles from './WishCrystal.module.scss';

type OwnProps = {
  // Raised amount divided by the target, may exceed 1
  progress: number;
  isComplete?: boolean;
  // Each increment lights the crystal up for a moment
  flashCount?: number;
  ref?: ElementRef<HTMLDivElement>;
  className?: string;
};

type Vector = [number, number, number];

type Face = {
  vertexIndexes: number[];
  normal: Vector;
  depth: number;
  light: number;
};

type CrystalState = {
  yaw: number;
  pitch: number;
  velocity: number;
  shownProgress: number;
  hue: number;
  flash: number;
  time: number;
  dragX?: number;
  dragY?: number;
};

const SIZE = 88;
const MAX_PIXEL_RATIO = 2;
const IS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const IDLE_VELOCITY = 0.004;
const VELOCITY_RECOVERY = 0.02;
const DRAG_YAW_FACTOR = 0.02;
const DRAG_PITCH_FACTOR = 0.01;
const MIN_PITCH = 0.05;
const MAX_PITCH = 0.8;
const INITIAL_YAW = 0.6;
const INITIAL_PITCH = 0.38;
const PROGRESS_EASING = 0.06;
const HUE_EASING = 0.04;
const FLASH_DECAY = 0.92;
const FLASH_STEP = 0.35;
const HUE_IN_PROGRESS = 205;
const HUE_COMPLETE = 45;

const SCALE = 0.34;
const LIGHT: Vector = [-0.45, 0.75, 0.5];
// A cooler rim light from below keeps the pavilion from going flat
const RIM_LIGHT: Vector = [0.6, -0.45, 0.65];
const KEY_LIGHT_SHARE = 0.75;
const RIM_LIGHT_SHARE = 0.4;
const AMBIENT_LIGHT = 0.08;
// Neighbouring facets alternate slightly in brightness, like the fire of a cut stone
const FACET_CONTRAST = 0.07;
const HIGHLIGHT_LIGHT = 0.8;
// The pavilion narrows to a point, so the level rises faster than the share to look as full as it is
const FILL_HEIGHT_EXPONENT = 0.6;
const EDGE_WIDTH = 0.75;
const SURFACE_WIDTH = 1.25;
const SURFACE_GLOW = 4;
const FRAME_TIME_STEP = 1 / 60;
const WAVE_AMPLITUDE = 1.8;
const WAVE_FREQUENCY = 0.16;
const WAVE_SPEED = 2.2;
const WAVE_HARMONIC = 2.3;
const WAVE_HARMONIC_SHARE = 0.4;
const WAVE_STEP = 2;
const WAVE_EDGE_DAMPING = 12;
const SPARKLE_RADIUS = 5;
const SPARKLE_SPEED = 1.3;
const SPARKLE_PHASE_STEP = 2.4;
const SPARKLE_SHARPNESS = 12;
const SPARKLE_MIN_INTENSITY = 0.02;
const GLOW_INNER_RADIUS = 2;

// Octagonal table, eight-sided girdle, culet and the body center used to orient normals outwards
const TABLE_RADIUS = 0.55;
const TABLE_Y = 0.62;
const GIRDLE_Y = 0.18;
const CULET_Y = -1.15;
const CENTER_Y = -0.1;
const SIDES = 8;
const CULET_INDEX = SIDES * 2;
const CENTER_INDEX = CULET_INDEX + 1;

// Every other table corner and every third girdle corner can glint
const SPARKLE_VERTEX_INDEXES = [0, 2, 4, 6, 8, 11, 14];

const VERTICES = buildVertices();
const FACES = buildFaces();

const WishCrystal = ({
  progress, isComplete, flashCount, ref, className,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const stateRef = useRef<CrystalState>({
    yaw: INITIAL_YAW,
    pitch: INITIAL_PITCH,
    velocity: IS_REDUCED_MOTION ? 0 : IDLE_VELOCITY,
    shownProgress: progress,
    hue: isComplete ? HUE_COMPLETE : HUE_IN_PROGRESS,
    flash: 0,
    time: 0,
  });
  const progressRef = useStateRef(progress);
  const isCompleteRef = useStateRef(isComplete);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    let frameId: number | undefined;

    function tick() {
      advanceState(stateRef.current, progressRef.current, isCompleteRef.current);
      drawCrystal(ctx, stateRef.current);
      frameId = requestAnimationFrame(tick);
    }

    function start() {
      if (frameId === undefined) frameId = requestAnimationFrame(tick);
    }

    function stop() {
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      frameId = undefined;
    }

    // The loop runs only while the crystal is on screen
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start();
      else stop();
    });
    observer.observe(canvas);

    drawCrystal(ctx, stateRef.current);

    return () => {
      observer.disconnect();
      stop();
    };
  }, [isCompleteRef, progressRef]);

  useEffect(() => {
    if (!flashCount) return;

    stateRef.current.flash = Math.min(1, stateRef.current.flash + FLASH_STEP);
  }, [flashCount]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    stateRef.current.dragX = e.clientX;
    stateRef.current.dragY = e.clientY;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = stateRef.current;
    if (state.dragX === undefined || state.dragY === undefined) return;

    const deltaX = e.clientX - state.dragX;
    state.yaw += deltaX * DRAG_YAW_FACTOR;
    state.velocity = deltaX * DRAG_YAW_FACTOR;
    state.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, state.pitch + (e.clientY - state.dragY) * DRAG_PITCH_FACTOR));
    state.dragX = e.clientX;
    state.dragY = e.clientY;
  }

  function handlePointerUp() {
    stateRef.current.dragX = undefined;
    stateRef.current.dragY = undefined;
  }

  // Keeps the row's ripple and click from reacting to a drag that starts on the crystal
  function stopPropagation(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  const pixelSize = Math.round(SIZE * Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));

  return (
    <div ref={ref} className={buildClassName(styles.root, className)}>
      <canvas ref={canvasRef} className={styles.canvas} width={pixelSize} height={pixelSize} />
      <div
        className={styles.hit}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
      />
    </div>
  );
};

function advanceState(state: CrystalState, progress: number, isComplete?: boolean) {
  if (state.dragX === undefined) {
    state.yaw += state.velocity;
    const idleVelocity = IS_REDUCED_MOTION ? 0 : IDLE_VELOCITY;
    state.velocity += (idleVelocity - state.velocity) * VELOCITY_RECOVERY;
  }

  const targetHue = isComplete ? HUE_COMPLETE : HUE_IN_PROGRESS;
  if (IS_REDUCED_MOTION) {
    state.shownProgress = progress;
    state.hue = targetHue;
  } else {
    state.shownProgress += (progress - state.shownProgress) * PROGRESS_EASING;
    state.hue += (targetHue - state.hue) * HUE_EASING;
    state.time += FRAME_TIME_STEP;
  }
  state.flash *= FLASH_DECAY;
}

function drawCrystal(ctx: CanvasRenderingContext2D, state: CrystalState) {
  const {
    yaw, pitch, shownProgress, hue, flash, time,
  } = state;
  const scale = SIZE * SCALE;
  const centerX = SIZE / 2;
  const centerY = SIZE / 2;

  const points = rotateVertices(yaw, pitch);
  const faces = buildLitFaces(points);
  const toX = (i: number) => centerX + points[i][0] * scale;
  const toY = (i: number) => centerY - points[i][1] * scale;

  let top = Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < CENTER_INDEX; i++) {
    top = Math.min(top, toY(i));
    bottom = Math.max(bottom, toY(i));
  }
  const fill = Math.min(1, Math.max(0, shownProgress));
  const level = bottom - (bottom - top) * fill ** FILL_HEIGHT_EXPONENT;
  // The surface calms down as the gem gets empty or full
  const waveAmplitude = WAVE_AMPLITUDE * Math.min(1, fill * WAVE_EDGE_DAMPING, (1 - fill) * WAVE_EDGE_DAMPING);
  const getSurfaceY = (x: number) => level
    + Math.sin(x * WAVE_FREQUENCY + time * WAVE_SPEED) * waveAmplitude
    + Math.sin(x * WAVE_FREQUENCY * WAVE_HARMONIC - time * WAVE_SPEED) * waveAmplitude * WAVE_HARMONIC_SHARE;

  function traceFace(vertexIndexes: number[]) {
    ctx.beginPath();
    vertexIndexes.forEach((index, i) => {
      if (i) ctx.lineTo(toX(index), toY(index));
      else ctx.moveTo(toX(index), toY(index));
    });
    ctx.closePath();
  }

  function traceSurface() {
    ctx.beginPath();
    ctx.moveTo(0, getSurfaceY(0));
    for (let x = WAVE_STEP; x <= SIZE; x += WAVE_STEP) {
      ctx.lineTo(x, getSurfaceY(x));
    }
  }

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.lineJoin = 'round';
  ctx.lineWidth = EDGE_WIDTH;

  // Empty glass: back faces barely visible, front faces catch a little light
  faces.forEach(({ vertexIndexes, normal, light }) => {
    const isFront = normal[2] > 0;
    traceFace(vertexIndexes);
    ctx.fillStyle = `rgba(150, 180, 225, ${isFront ? 0.1 + light * 0.18 : 0.05})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(190, 215, 255, ${isFront ? 0.3 + light * 0.35 : 0.12})`;
    ctx.stroke();
  });

  // Liquid below the wavy surface, lit per facet
  ctx.save();
  traceSurface();
  ctx.lineTo(SIZE, SIZE);
  ctx.lineTo(0, SIZE);
  ctx.closePath();
  ctx.clip();
  faces.forEach(({ vertexIndexes, normal, light }) => {
    const isFront = normal[2] > 0;
    traceFace(vertexIndexes);
    ctx.fillStyle = `hsla(${hue}, 92%, ${22 + light * 50}%, ${isFront ? 0.94 : 0.4})`;
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue}, 100%, 88%, ${isFront ? 0.25 + light * 0.45 : 0.15})`;
    ctx.stroke();
    if (isFront && light > HIGHLIGHT_LIGHT) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(light - HIGHLIGHT_LIGHT) * 1.6})`;
      ctx.fill();
    }
  });

  // The liquid is brighter near its surface and deeper towards the culet
  ctx.globalCompositeOperation = 'source-atop';
  const depth = ctx.createLinearGradient(0, level, 0, bottom);
  depth.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  depth.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
  depth.addColorStop(1, `hsla(${hue}, 90%, 12%, 0.35)`);
  ctx.fillStyle = depth;
  ctx.fillRect(0, level - WAVE_AMPLITUDE * 2, SIZE, SIZE);
  ctx.restore();

  // Surface line and flash stay within the gem's painted pixels
  ctx.globalCompositeOperation = 'source-atop';
  if (fill > 0 && fill < 1) {
    traceSurface();
    ctx.lineWidth = SURFACE_WIDTH;
    ctx.strokeStyle = `hsla(${hue}, 100%, 92%, 0.85)`;
    ctx.shadowColor = `hsla(${hue}, 100%, 75%, 0.9)`;
    ctx.shadowBlur = SURFACE_GLOW;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (flash > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.5})`;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // The glow fades to zero at the canvas edge, so it never shows a hard cut-off
  ctx.globalCompositeOperation = 'destination-over';
  const glow = ctx.createRadialGradient(centerX, centerY, GLOW_INNER_RADIUS, centerX, centerY, SIZE / 2);
  glow.addColorStop(0, `hsla(${hue}, 95%, 60%, ${0.12 + fill * 0.28 + flash * 0.35})`);
  glow.addColorStop(0.55, `hsla(${hue}, 95%, 60%, ${0.04 + fill * 0.08 + flash * 0.1})`);
  glow.addColorStop(1, `hsla(${hue}, 95%, 60%, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.globalCompositeOperation = 'source-over';

  if (!IS_REDUCED_MOTION) {
    drawSparkles(ctx, points, toX, toY, time);
  }
}

// Short-lived four-point glints on the front corners of the table and girdle
function drawSparkles(
  ctx: CanvasRenderingContext2D,
  points: Vector[],
  toX: (index: number) => number,
  toY: (index: number) => number,
  time: number,
) {
  SPARKLE_VERTEX_INDEXES.forEach((index, i) => {
    if (points[index][2] < 0) return;

    const intensity = Math.max(0, Math.sin(time * SPARKLE_SPEED + i * SPARKLE_PHASE_STEP)) ** SPARKLE_SHARPNESS;
    if (intensity < SPARKLE_MIN_INTENSITY) return;

    const x = toX(index);
    const y = toY(index);
    const radius = SPARKLE_RADIUS * intensity;
    const glint = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glint.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
    glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.quadraticCurveTo(x, y, x, y + radius);
    ctx.quadraticCurveTo(x, y, x - radius, y);
    ctx.quadraticCurveTo(x, y, x, y - radius);
    ctx.fill();
  });
}

function rotateVertices(yaw: number, pitch: number): Vector[] {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  return VERTICES.map(([x, y, z]) => {
    const yawX = x * cosYaw + z * sinYaw;
    const yawZ = -x * sinYaw + z * cosYaw;
    return [yawX, y * cosPitch - yawZ * sinPitch, y * sinPitch + yawZ * cosPitch];
  });
}

// Painter's algorithm: faces are sorted back to front
function buildLitFaces(points: Vector[]): Face[] {
  const center = points[CENTER_INDEX];

  return FACES.map((vertexIndexes, faceIndex) => {
    const [a, b, c] = vertexIndexes.map((i) => points[i]);
    const u = subtract(b, a);
    const v = subtract(c, a);
    let normal = normalize([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    const faceCenter = [0, 1, 2].map((axis) => (
      vertexIndexes.reduce((sum, i) => sum + points[i][axis], 0) / vertexIndexes.length
    )) as Vector;
    if (dot(normal, subtract(faceCenter, center)) < 0) {
      normal = normal.map((value) => -value) as Vector;
    }

    return {
      vertexIndexes,
      normal,
      depth: faceCenter[2],
      light: Math.max(0, Math.min(1, AMBIENT_LIGHT
      + Math.max(0, dot(normal, LIGHT)) * KEY_LIGHT_SHARE
      + Math.max(0, dot(normal, RIM_LIGHT)) * RIM_LIGHT_SHARE
      + (faceIndex % 2 ? FACET_CONTRAST : -FACET_CONTRAST))),
    };
  }).sort((a, b) => a.depth - b.depth);
}

function buildVertices(): Vector[] {
  const vertices: Vector[] = [];
  for (let i = 0; i < SIDES; i++) {
    const angle = (i * Math.PI * 2) / SIDES;
    vertices.push([Math.cos(angle) * TABLE_RADIUS, TABLE_Y, Math.sin(angle) * TABLE_RADIUS]);
  }
  for (let i = 0; i < SIDES; i++) {
    const angle = ((i + 0.5) * Math.PI * 2) / SIDES;
    vertices.push([Math.cos(angle), GIRDLE_Y, Math.sin(angle)]);
  }
  vertices.push([0, CULET_Y, 0], [0, CENTER_Y, 0]);

  return vertices;
}

// 1 table + 8 crown triangles + 8 star triangles + 8 pavilion triangles
function buildFaces() {
  const faces: number[][] = [Array.from({ length: SIDES }, (_, i) => i)];
  for (let i = 0; i < SIDES; i++) {
    const next = (i + 1) % SIDES;
    faces.push(
      [i, next, SIDES + i],
      [SIDES + ((i + SIDES - 1) % SIDES), SIDES + i, i],
      [SIDES + i, SIDES + next, CULET_INDEX],
    );
  }

  return faces;
}

function subtract(a: Vector, b: Vector): Vector {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vector, b: Vector) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(...vector) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export default memo(WishCrystal);
