import { memo, useEffect, useRef } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import { useStateRef } from '../../hooks/useStateRef';

import styles from './WishCrystal.module.scss';

type OwnProps = {
  // Raised amount divided by the target, may exceed 1
  progress: number;
  isComplete?: boolean;
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
const HUE_IN_PROGRESS = 205;
const HUE_COMPLETE = 45;

const SCALE = 0.34;
const LIGHT: Vector = [-0.45, 0.75, 0.5];
const HIGHLIGHT_LIGHT = 0.8;
const LEVEL_LINE_HALF_HEIGHT = 6;
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

const VERTICES = buildVertices();
const FACES = buildFaces();

const WishCrystal = ({ progress, isComplete, className }: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const stateRef = useRef<CrystalState>({
    yaw: INITIAL_YAW,
    pitch: INITIAL_PITCH,
    velocity: IS_REDUCED_MOTION ? 0 : IDLE_VELOCITY,
    shownProgress: progress,
    hue: isComplete ? HUE_COMPLETE : HUE_IN_PROGRESS,
    flash: 0,
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
    <div className={buildClassName(styles.root, className)}>
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
  }
  state.flash *= FLASH_DECAY;
}

function drawCrystal(ctx: CanvasRenderingContext2D, state: CrystalState) {
  const {
    yaw, pitch, shownProgress, hue, flash,
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
  const level = bottom - (bottom - top) * fill;

  function drawFaces(isFilled: boolean) {
    faces.forEach(({ vertexIndexes, normal, light }) => {
      const isFront = normal[2] > 0;
      ctx.beginPath();
      vertexIndexes.forEach((index, i) => {
        if (i) ctx.lineTo(toX(index), toY(index));
        else ctx.moveTo(toX(index), toY(index));
      });
      ctx.closePath();

      ctx.fillStyle = isFilled
        ? `hsla(${hue}, 95%, ${24 + light * 52}%, ${isFront ? 0.95 : 0.35})`
        : `rgba(130, 160, 200, ${isFront ? 0.14 + light * 0.16 : 0.06})`;
      ctx.fill();
      ctx.strokeStyle = isFilled ? 'rgba(255, 255, 255, 0.45)' : 'rgba(150, 180, 220, 0.4)';
      ctx.stroke();

      if (isFilled && isFront && light > HIGHLIGHT_LIGHT) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(light - HIGHLIGHT_LIGHT) * 2})`;
        ctx.fill();
      }
    });
  }

  ctx.clearRect(0, 0, SIZE, SIZE);
  drawFaces(false);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, level, SIZE, SIZE);
  ctx.clip();
  drawFaces(true);
  ctx.restore();

  // Highlight line and flash stay within the gem's painted pixels
  ctx.globalCompositeOperation = 'source-atop';
  const line = ctx.createLinearGradient(0, level - LEVEL_LINE_HALF_HEIGHT, 0, level + LEVEL_LINE_HALF_HEIGHT);
  line.addColorStop(0, 'rgba(255, 255, 255, 0)');
  line.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
  line.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = line;
  ctx.fillRect(0, level - LEVEL_LINE_HALF_HEIGHT, SIZE, LEVEL_LINE_HALF_HEIGHT * 2);
  if (flash > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.5})`;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // The glow fades to zero at the canvas edge, so it never shows a hard cut-off
  ctx.globalCompositeOperation = 'destination-over';
  const glow = ctx.createRadialGradient(centerX, centerY, GLOW_INNER_RADIUS, centerX, centerY, SIZE / 2);
  glow.addColorStop(0, `hsla(${hue}, 95%, 60%, ${0.1 + fill * 0.25 + flash * 0.35})`);
  glow.addColorStop(1, `hsla(${hue}, 95%, 60%, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.globalCompositeOperation = 'source-over';
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

  return FACES.map((vertexIndexes) => {
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
      light: Math.max(0, dot(normal, LIGHT)),
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
