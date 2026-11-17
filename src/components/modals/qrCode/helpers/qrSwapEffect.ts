import { buildColor, mixColors, serializeColor } from '../../../../lib/color';
import { CARD_BOUNCE_ANIMATION } from './themeWave';

export type QrSwapCode = {
  link: string;
  moduleCount: number;
  cell: number;
  origin: number;
  size: number;
  image: HTMLCanvasElement;
  modules: Int32Array;
  noise: Float32Array;
  rgb: Uint8Array;
};

export type QrSwapGeometry = {
  qrSize: number;
  card: Rect;
};

export type QrSwapEffect = {
  setGeometry: (geometry: QrSwapGeometry) => void;
  hold: (fromLink: string | undefined, toLink: string) => boolean;
  hasCode: (link: string) => boolean;
  swap: (code: QrSwapCode) => void;
  setCode: (code: QrSwapCode) => void;
  release: () => void;
  destroy: () => void;
};

type Rect = { left: number; top: number; right: number; bottom: number };

type Particles = {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  size: Float32Array;
  life: Float32Array;
  age: Float32Array;
  rotation: Float32Array;
  spin: Float32Array;
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
  kind: Uint8Array;
  fills: string[];
  count: number;
};

export const QR_SWAP_MARGIN = 80;

const SVG_MIME_TYPE = 'image/svg+xml';
const MAX_RASTER_SCALE = 3;
const DARK_ALPHA = 40;
const DARK_SAMPLE_OFFSETS = [-0.3, 0, 0.3];

const SWAP_DELAY_MS = 40;
const MAX_KNOWN_CODES = 3;
const DUST_MS = 450;
const COVER_COLOR = '#ffffff';
const WHITE = buildColor(COVER_COLOR);

const FRONT_START = -1.5;
const FRONT_EXTRA_ROWS = 6;
const FRONT_EASE_BASE = 0.55;
const FRONT_EASE_TAIL = 0.45;
const NOISE_ROWS = 3.2;

const SHIVER_ROWS = 2.2;
const SHIVER_AMPLITUDE = 1.4;
const SHIVER_LIFT = 1.5;
const SHIVER_DIM = 0.25;
const SHIVER_PHASE = 60;
const SHIVER_PHASE_X = 13;
const SHIVER_PHASE_Y = 7;

const NEW_DELAY_ROWS = 1.6;
const POP_ROWS = 2.4;
const POP_FROM = 0.35;
const POP_OVERSHOOT = 2.2;
const POP_ALPHA_RATE = 2.5;
const POP_SETTLE_FROM = 0.4;
const POP_SETTLE_EPSILON = 0.01;

const PARTICLE_CAP = 2400;
const TWO_PARTICLES_CHANCE = 0.12;
const THREE_PARTICLES_CHANCE = 0.7;
const SPARK_CHANCE = 0.3;
const GLINT_CHANCE = 0.14;
const SPAWN_JITTER = 0.5;
const SPARK_RADIUS_MIN = 0.9;
const SPARK_RADIUS_SPREAD = 0.9;
const CHUNK_SIZE_MIN = 1.25;
const CHUNK_SIZE_SPREAD = 0.45;
const DUST_SIZE_MIN = 0.3;
const DUST_SIZE_SPREAD = 0.55;
const SPEED_MIN = 110;
const SPEED_SPREAD = 150;
const RADIAL_MIN = 0.45;
const RADIAL_SPREAD = 0.35;
const SIDE_JITTER = 90;
const UP_BIAS = 30;
const LIFE_MIN = 0.3;
const LIFE_SPREAD = 0.2;
const ROTATION_SPREAD = 90;
const SPIN_SPREAD = 720;
const LIFT = 20;
const DRAG_X = 2.4;
const DRAG_Y = 3;
const CEILING_GAP = 56;
const CEILING_DAMPING = 0.85;
const CEILING_FADE = 24;
const FADE_IN = 0.08;
const SHRINK = 0.85;
const CORNER_RADIUS = 0.3;
const WHITE_DISTANCE = 36;
const WHITE_STEPS = 32;
const SPARK_ALPHA = 0.9;
const HALO_SCALE = 2.6;
const HALO_ALPHA = 0.22;
const GLINT_ALPHA = 200 / 255;
const GLINT_SPEED = 1.6;

const KIND_INK = 0;
const KIND_GLINT = 1;
const KIND_SPARK = 2;

const MAX_DT = 0.05;
const FIRST_DT = 0.016;
const DEGREES_TO_RADIANS = Math.PI / 180;

const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const UINT32_RANGE = 2 ** 32;

export async function buildQrSwapCode({
  svg, link, moduleCount, svgSize, svgMargin, dpr,
}: {
  svg: SVGSVGElement;
  link: string;
  moduleCount: number;
  svgSize: number;
  svgMargin: number;
  dpr: number;
}): Promise<QrSwapCode> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelector('rect[clip-path*="background-color"]')?.remove();
  clone.querySelectorAll('image').forEach((element) => element.remove());

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: SVG_MIME_TYPE }));
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }

  const scale = Math.min(MAX_RASTER_SCALE, Math.ceil(dpr));
  const size = svgSize * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const dot = Math.floor((svgSize - 2 * svgMargin) / moduleCount);
  const cell = dot * scale;
  const origin = Math.floor((svgSize - moduleCount * dot) / 2) * scale;
  const random = createSeededRandom(getStringHash(link));
  const noise = new Float32Array(moduleCount * moduleCount);
  const rgb = new Uint8Array(moduleCount * moduleCount * 3);
  const modules: number[] = [];

  for (let y = 0; y < moduleCount; y++) {
    const sampleY = Math.floor(origin + (y + 0.5) * cell);
    for (let x = 0; x < moduleCount; x++) {
      const index = y * moduleCount + x;
      noise[index] = random();

      let pixel = -1;
      let alpha = DARK_ALPHA;
      for (const offset of DARK_SAMPLE_OFFSETS) {
        const sampleX = Math.floor(origin + (x + 0.5 + offset) * cell);
        const position = (sampleY * size + sampleX) * 4;
        if (data[position + 3] > alpha) {
          alpha = data[position + 3];
          pixel = position;
        }
      }
      if (pixel < 0) continue;

      modules.push(index);
      rgb.set(data.subarray(pixel, pixel + 3), index * 3);
    }
  }

  return {
    link,
    moduleCount,
    cell,
    origin,
    size,
    image: canvas,
    modules: Int32Array.from(modules),
    noise,
    rgb,
  };
}

export function createQrSwapEffect({
  canvas, cardElement, dpr, schedule,
}: {
  canvas: HTMLCanvasElement;
  cardElement: HTMLElement;
  dpr: number;
  schedule: (tick: () => boolean) => void;
}): QrSwapEffect {
  const ctx = canvas.getContext('2d')!;
  const layer = document.createElement('canvas');
  const layerCtx = layer.getContext('2d')!;
  const particles = createParticles();
  const mixedFills = new Map<number, string>();
  const knownCodes = new Map<string, QrSwapCode>();

  let qrSize = 0;
  let card: Rect = {
    left: 0, top: 0, right: 0, bottom: 0,
  };
  let canvasSize = 0;
  let current: QrSwapCode | undefined;
  let previous: QrSwapCode | undefined;
  let pending: QrSwapCode | undefined;
  let pendingAt = 0;
  let isHolding = false;
  let progress = 1;
  let swapStart = 0;
  let spawned: Uint8Array | undefined;
  let lastFrame = 0;
  let isRunning = false;
  let isDestroyed = false;

  function setGeometry(geometry: QrSwapGeometry) {
    qrSize = geometry.qrSize;
    card = geometry.card;
    const size = qrSize + 2 * QR_SWAP_MARGIN;
    if (size === canvasSize) return;
    canvasSize = size;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
  }

  function hold(fromLink: string | undefined, toLink: string) {
    if (isDestroyed || !qrSize || fromLink === toLink) return false;
    if (!getIsCovering()) {
      if (!current || current.link !== fromLink) return false;

      isHolding = true;
      draw(performance.now());
      start();
    }

    const knownCode = knownCodes.get(toLink);
    if (knownCode) swap(knownCode);
    return true;
  }

  function hasCode(link: string) {
    return pending?.link === link || current?.link === link;
  }

  function swap(code: QrSwapCode) {
    remember(code);
    pending = code;
    pendingAt = performance.now() + SWAP_DELAY_MS;
    start();
  }

  function setCode(code: QrSwapCode) {
    knownCodes.clear();
    remember(code);
    resizeLayer(code.size);
    current = code;
    previous = undefined;
    pending = undefined;
    isHolding = false;
    progress = 1;
    start();
  }

  function release() {
    pending = undefined;
    isHolding = false;
    previous = undefined;
    progress = 1;
    start();
  }

  function remember(code: QrSwapCode) {
    knownCodes.delete(code.link);
    knownCodes.set(code.link, code);
    if (knownCodes.size > MAX_KNOWN_CODES) {
      knownCodes.delete(knownCodes.keys().next().value!);
    }
  }

  function begin(code: QrSwapCode, now: number) {
    cardElement.animate(CARD_BOUNCE_ANIMATION.keyframes, { duration: CARD_BOUNCE_ANIMATION.duration });
    isHolding = false;

    if (!current) {
      current = code;
      return;
    }

    previous = progress < 1 && previous ? previous : current;
    current = code;
    progress = 0;
    swapStart = now;
    spawned = new Uint8Array(previous.moduleCount * previous.moduleCount);
  }

  function getIsCovering() {
    return isHolding || Boolean(pending) || progress < 1;
  }

  function start() {
    if (isRunning || isDestroyed) return;
    isRunning = true;
    lastFrame = 0;
    schedule(tick);
  }

  function tick() {
    if (isDestroyed) {
      isRunning = false;
      return false;
    }

    const now = performance.now();
    draw(now);
    isRunning = getIsCovering() || particles.count > 0;
    return isRunning;
  }

  function draw(now: number) {
    const dt = lastFrame ? Math.min(MAX_DT, (now - lastFrame) / 1000) : FIRST_DT;
    lastFrame = now;

    if (pending && now >= pendingAt) {
      begin(pending, now);
      pending = undefined;
    }
    if (progress < 1) {
      progress = Math.min(1, (now - swapStart) / DUST_MS);
      if (progress === 1) previous = undefined;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    if (getIsCovering() && current) {
      ctx.fillStyle = COVER_COLOR;
      ctx.fillRect(QR_SWAP_MARGIN, QR_SWAP_MARGIN, qrSize, qrSize);
      if (previous) {
        drawLayer(previous, current);
        ctx.drawImage(layer, QR_SWAP_MARGIN, QR_SWAP_MARGIN, qrSize, qrSize);
      } else {
        ctx.drawImage(current.image, QR_SWAP_MARGIN, QR_SWAP_MARGIN, qrSize, qrSize);
      }
    }

    drawParticles(dt);
  }

  function resizeLayer(size: number) {
    if (layer.width === size) return;
    layer.width = size;
    layer.height = size;
  }

  function drawLayer(from: QrSwapCode, to: QrSwapCode) {
    resizeLayer(to.size);
    layerCtx.globalAlpha = 1;
    layerCtx.clearRect(0, 0, layer.width, layer.height);

    const rasterPerPixel = to.size / qrSize;
    const fromFront = getFront(from.moduleCount, progress);
    const toFront = getFront(to.moduleCount, progress);

    for (const index of from.modules) {
      const x = index % from.moduleCount;
      const y = (index - x) / from.moduleCount;
      const threshold = from.moduleCount - 1 - y + from.noise[index] * NOISE_ROWS;
      if (fromFront > threshold) {
        if (!spawned![index]) {
          spawned![index] = 1;
          spawnModule(from, x, y, index);
        }
        continue;
      }

      const near = 1 - Math.min(1, (threshold - fromFront) / SHIVER_ROWS);
      const shiverX = near > 0
        ? Math.sin(x * SHIVER_PHASE_X + y * SHIVER_PHASE_Y + progress * SHIVER_PHASE) * SHIVER_AMPLITUDE * near
        : 0;
      const cellX = from.origin + x * from.cell;
      const cellY = from.origin + y * from.cell;
      layerCtx.globalAlpha = 1 - near * SHIVER_DIM;
      layerCtx.drawImage(
        from.image, cellX, cellY, from.cell, from.cell,
        cellX + shiverX * rasterPerPixel, cellY - near * SHIVER_LIFT * rasterPerPixel, from.cell, from.cell,
      );
    }

    for (const index of to.modules) {
      const x = index % to.moduleCount;
      const y = (index - x) / to.moduleCount;
      const threshold = to.moduleCount - 1 - y + to.noise[index] * NOISE_ROWS + NEW_DELAY_ROWS;
      if (toFront <= threshold) continue;

      const pop = Math.min(1, (toFront - threshold) / POP_ROWS);
      const scale = POP_FROM + (1 - POP_FROM) * getBackOut(pop);
      const cellX = to.origin + x * to.cell;
      const cellY = to.origin + y * to.cell;
      if (pop >= 1 || (pop > POP_SETTLE_FROM && Math.abs(scale - 1) < POP_SETTLE_EPSILON)) {
        layerCtx.globalAlpha = 1;
        layerCtx.drawImage(to.image, cellX, cellY, to.cell, to.cell, cellX, cellY, to.cell, to.cell);
        continue;
      }

      const side = to.cell * scale;
      const offset = (to.cell - side) / 2;
      layerCtx.globalAlpha = Math.min(1, pop * POP_ALPHA_RATE);
      layerCtx.drawImage(to.image, cellX, cellY, to.cell, to.cell, cellX + offset, cellY + offset, side, side);
    }
    layerCtx.globalAlpha = 1;
  }

  function spawnModule(code: QrSwapCode, x: number, y: number, index: number) {
    const pixelPerRaster = qrSize / code.size;
    const size = code.cell * pixelPerRaster;
    const centerX = QR_SWAP_MARGIN + (code.origin + (x + 0.5) * code.cell) * pixelPerRaster;
    const centerY = QR_SWAP_MARGIN + (code.origin + (y + 0.5) * code.cell) * pixelPerRaster;
    const dx = centerX - (QR_SWAP_MARGIN + qrSize / 2);
    const dy = centerY - (QR_SWAP_MARGIN + qrSize / 2);
    const distance = Math.max(1, Math.hypot(dx, dy));
    const roll = Math.random();
    const count = roll < TWO_PARTICLES_CHANCE ? 2 : roll < THREE_PARTICLES_CHANCE ? 3 : 5;
    const r = code.rgb[index * 3];
    const g = code.rgb[index * 3 + 1];
    const b = code.rgb[index * 3 + 2];
    const fill = `rgb(${r},${g},${b})`;

    for (let k = 0; k < count; k++) {
      if (particles.count >= PARTICLE_CAP) return;
      const i = particles.count++;
      const isSpark = k > 0 && Math.random() < SPARK_CHANCE;
      particles.kind[i] = isSpark ? KIND_SPARK : Math.random() < GLINT_CHANCE ? KIND_GLINT : KIND_INK;
      particles.x[i] = centerX + (Math.random() - 0.5) * size * SPAWN_JITTER;
      particles.y[i] = centerY + (Math.random() - 0.5) * size * SPAWN_JITTER;
      particles.size[i] = isSpark
        ? SPARK_RADIUS_MIN + Math.random() * SPARK_RADIUS_SPREAD
        : k === 0 && roll < TWO_PARTICLES_CHANCE
          ? size * (CHUNK_SIZE_MIN + Math.random() * CHUNK_SIZE_SPREAD)
          : size * (DUST_SIZE_MIN + Math.random() * DUST_SIZE_SPREAD);
      const speed = SPEED_MIN + Math.random() * SPEED_SPREAD;
      const radial = RADIAL_MIN + Math.random() * RADIAL_SPREAD;
      particles.vx[i] = (dx / distance) * speed * radial + (Math.random() - 0.5) * SIDE_JITTER;
      particles.vy[i] = (dy / distance) * speed * radial - speed * (1 - radial) - UP_BIAS;
      particles.life[i] = LIFE_MIN + Math.random() * LIFE_SPREAD;
      particles.age[i] = 0;
      particles.rotation[i] = Math.random() * ROTATION_SPREAD;
      particles.spin[i] = (Math.random() - 0.5) * SPIN_SPREAD;
      particles.r[i] = r;
      particles.g[i] = g;
      particles.b[i] = b;
      particles.fills[i] = fill;
    }
  }

  function drawParticles(dt: number) {
    const ceiling = card.top - CEILING_GAP;

    for (let i = particles.count - 1; i >= 0; i--) {
      particles.age[i] += dt;
      if (particles.age[i] >= particles.life[i]) {
        removeParticle(i);
        continue;
      }

      particles.vy[i] -= LIFT * dt;
      particles.vx[i] *= 1 - DRAG_X * dt;
      particles.vy[i] *= 1 - DRAG_Y * dt;
      if (particles.y[i] < ceiling) particles.vy[i] *= CEILING_DAMPING;
      particles.x[i] += particles.vx[i] * dt;
      particles.y[i] += particles.vy[i] * dt;
      particles.rotation[i] += particles.spin[i] * dt;

      const x = particles.x[i];
      const y = particles.y[i];
      const t = particles.age[i] / particles.life[i];
      let alpha = t < FADE_IN ? t / FADE_IN : 1 - (t - FADE_IN) / (1 - FADE_IN);
      if (y < ceiling) alpha *= Math.max(0, 1 - (ceiling - y) / CEILING_FADE);
      if (alpha <= 0) continue;
      const size = particles.size[i] * (1 - (1 - (1 - t) ** 2) * SHRINK);

      if (particles.kind[i] === KIND_SPARK) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        fillCircle(x, y, size, SPARK_ALPHA * alpha);
        fillCircle(x, y, size * HALO_SCALE, HALO_ALPHA * alpha);
        continue;
      }

      const outside = Math.max(card.left - x, x - card.right, card.top - y, y - card.bottom, 0);
      const angle = particles.rotation[i] * DEGREES_TO_RADIANS;
      const cos = Math.cos(angle) * dpr;
      const sin = Math.sin(angle) * dpr;
      ctx.setTransform(cos, sin, -sin, cos, x * dpr, y * dpr);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = outside > 0 ? getMixedFill(i, Math.min(1, outside / WHITE_DISTANCE)) : particles.fills[i];
      ctx.beginPath();
      ctx.roundRect(-size / 2, -size / 2, size, size, size * CORNER_RADIUS);
      ctx.fill();
      if (particles.kind[i] === KIND_GLINT) {
        ctx.globalAlpha = GLINT_ALPHA * alpha * Math.sin(Math.PI * Math.min(1, t * GLINT_SPEED));
        ctx.fillStyle = COVER_COLOR;
        ctx.fill();
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
  }

  function fillCircle(x: number, y: number, radius: number, alpha: number) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COVER_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function getMixedFill(i: number, amount: number) {
    const step = Math.round(amount * WHITE_STEPS);
    const key = ((particles.r[i] << 16) | (particles.g[i] << 8) | particles.b[i]) * (WHITE_STEPS + 1) + step;
    let fill = mixedFills.get(key);
    if (!fill) {
      const ink = buildColor(`rgb(${particles.r[i]} ${particles.g[i]} ${particles.b[i]})`);
      const mixed = mixColors(ink, WHITE, step / WHITE_STEPS, { space: 'oklab', outputSpace: 'srgb' });
      fill = serializeColor(mixed, { format: 'hex', collapse: false, alpha: false });
      mixedFills.set(key, fill);
    }
    return fill;
  }

  function removeParticle(i: number) {
    const last = --particles.count;
    if (i === last) return;
    particles.x[i] = particles.x[last];
    particles.y[i] = particles.y[last];
    particles.vx[i] = particles.vx[last];
    particles.vy[i] = particles.vy[last];
    particles.size[i] = particles.size[last];
    particles.life[i] = particles.life[last];
    particles.age[i] = particles.age[last];
    particles.rotation[i] = particles.rotation[last];
    particles.spin[i] = particles.spin[last];
    particles.r[i] = particles.r[last];
    particles.g[i] = particles.g[last];
    particles.b[i] = particles.b[last];
    particles.kind[i] = particles.kind[last];
    particles.fills[i] = particles.fills[last];
  }

  function destroy() {
    isDestroyed = true;
  }

  return {
    setGeometry, hold, hasCode, swap, setCode, release, destroy,
  };
}

function getFront(moduleCount: number, progress: number) {
  const rest = 1 - progress;
  const eased = 1 - rest * rest * (FRONT_EASE_BASE + FRONT_EASE_TAIL * rest);
  return FRONT_START + eased * (moduleCount + FRONT_EXTRA_ROWS);
}

function getBackOut(value: number) {
  const shifted = value - 1;
  return 1 + (POP_OVERSHOOT + 1) * shifted ** 3 + POP_OVERSHOOT * shifted ** 2;
}

function createParticles(): Particles {
  return {
    x: new Float32Array(PARTICLE_CAP),
    y: new Float32Array(PARTICLE_CAP),
    vx: new Float32Array(PARTICLE_CAP),
    vy: new Float32Array(PARTICLE_CAP),
    size: new Float32Array(PARTICLE_CAP),
    life: new Float32Array(PARTICLE_CAP),
    age: new Float32Array(PARTICLE_CAP),
    rotation: new Float32Array(PARTICLE_CAP),
    spin: new Float32Array(PARTICLE_CAP),
    r: new Uint8Array(PARTICLE_CAP),
    g: new Uint8Array(PARTICLE_CAP),
    b: new Uint8Array(PARTICLE_CAP),
    kind: new Uint8Array(PARTICLE_CAP),
    fills: new Array<string>(PARTICLE_CAP),
    count: 0,
  };
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, LCG_MULTIPLIER) + LCG_INCREMENT) >>> 0;
    return state / UINT32_RANGE;
  };
}

function getStringHash(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  }
  return hash;
}
