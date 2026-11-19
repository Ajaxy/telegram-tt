import type { GpuDeviceHold } from '../gpu/device';
import type {
  GpuCanvasCommand, GpuCanvasFrame, GpuCanvasKind, GpuCanvasWorkerMessage, SpoilerRect,
} from './types';
import { SPOILER_EDGE_FADE, SPOILER_MORPH, SPOILER_MORPH_DURATION } from './types';

import { acquireGpuDevice } from '../gpu/device';
import emojiShader from './shaders/emoji.wgsl?raw';
import particlesShader from './shaders/particles.wgsl?raw';
import spoilerShader from './shaders/spoiler.wgsl?raw';
import textParticlesShader from './shaders/textParticles.wgsl?raw';

type Renderer = GpuDeviceHold & {
  computePipeline: GPUComputePipeline;
  particlePipeline: GPURenderPipeline;
  spoilerPipeline: GPURenderPipeline;
  emojiPipeline: GPURenderPipeline;
  textAssignPipeline: GPUComputePipeline;
  textParticlePipeline: GPURenderPipeline;
  // Bound for the glyphs of text particles outside a morph
  emptyGlyphBuffer: GPUBuffer;
  tileSampler: GPUSampler;
  emojiSampler: GPUSampler;
};

// The particle field every media spoiler samples
type Tile = {
  size: number;
  scale: number;
  particleCount: number;
  texture: GPUTexture;
  particles: GPUBuffer;
  uniform: GPUBuffer;
  computeBindGroup: GPUBindGroup;
  renderBindGroup: GPUBindGroup;
  time: number;
  frameIndex: number;
  shouldReset: boolean;
};

type EmojiView = {
  renderId: string;
  x: number;
  y: number;
  size: number;
  frameIndex?: number;
  drawnFrame?: GpuCanvasFrame;
  texture?: GPUTexture;
  uniform?: GPUBuffer;
  bindGroup?: GPUBindGroup;
};

// Concealed custom emoji show within `radius` of the reveal origin in canvas pixels, fading in over `edge` pixels
// before it
type EmojiFront = {
  radius: number;
  edge: number;
};

type Instance = {
  kind: GpuCanvasKind;
  canvas: OffscreenCanvas;
  context?: GPUCanvasContext;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  rects: SpoilerRect[];
  // Spoilers measured during the reveal, applied once it ends
  pendingRects?: SpoilerRect[];
  isRevealed?: boolean;
  // Text particles find their glyphs in the first frame of a reveal
  reveal?: {
    x: number;
    y: number;
    startedAt: number;
    glyphs?: ImageBitmap;
    glyphTexture?: GPUTexture;
    // Clock of the text particles at the first frame of the morph
    anchorClock?: number;
  };
  isVisible?: boolean;
  isDirty: boolean;
  // When the particles were first drawn, so they fade in instead of popping up
  appearedAt?: number;
  shouldUpdateRects: boolean;
  // Shifts the tile, so neighboring spoilers do not look the same
  tileOffsetX: number;
  tileOffsetY: number;
  rectCount: number;
  rectBuffer?: GPUBuffer;
  // Text particles drift by this clock in seconds, which runs while they animate
  clock: number;
  particleCount: number;
  // Where text particles fly on a reveal
  glyphBuffer?: GPUBuffer;
  textRenderBindGroup?: GPUBindGroup;
  scene?: GPUBuffer;
  spoilerBindGroup?: GPUBindGroup;
  spoilerBindGroupTile?: Tile;
  emojiBindGroup?: GPUBindGroup;
  emojis: Map<string, EmojiView>;
};

const TILE_FORMAT = 'r8unorm';
// Media follow the noise of Android `SpoilerEffect2`, text the dense small particles of `SpoilerEffect`.
// Sides and particle diameters are in CSS pixels, densities in particles per CSS pixel squared.
const TILE_CONFIG = { size: 320, density: 0.03, particleSize: 2 };
const TEXT_DENSITY = 0.1;
const TEXT_PARTICLE_SIZE = 2;
const TEXT_WORKGROUP_SIZE = 64;
const GLYPH_BYTES = 32;
// Keeps a huge spoiler from allocating too much memory
const MAX_TEXT_PARTICLES = 200000;
const COPIES_PER_PARTICLE = 4;
const PARAMS_SIZE = 80;
const SCENE_SIZE = 64;
const VIEW_SIZE = 32;
const RECT_FLOATS = 8;
const PARTICLE_STRIDE = 32;
const WORKGROUP_SIZE = 128;
const BYTES_PER_PIXEL = 4;
const COLOR_CHANNEL_MAX = 255;
const MAX_FRAMES_IN_FLIGHT = 2;
// Width of the reveal ripple ring in CSS pixels
const RIPPLE_RING = 48;
// Matches the quadratic reveal in `MediaSpoiler.module.scss`, so particles leave with the content
const REVEAL_DURATION = 500;
// The media cut ends past the farthest corner by its soft edge
const MEDIA_REVEAL_OVERSHOOT = 1.04;
// Particles fade in on mount, as the worker draws them a few frames after the element appears
const APPEAR_DURATION = 200;
const MAX_DELTA = 0.1;
// Lets a frame of a capped rate through despite the display timing jitter
const FRAME_INTERVAL_TOLERANCE = 2;
const DEFAULT_DELTA = 1 / 60;
// Steps simulated before the only frame drawn when animations are disabled
const STATIC_STEPS = 60;
const NOISE_SCALE = 22;
const NOISE_SPEED = 0.6;
const NOISE_MOVEMENT = 4;
const FORCE_MULTIPLIER = 0.6;
const DAMPING = 0.9999;
const VELOCITY_MULTIPLIER = 1;
const MAX_VELOCITY = 6;
const LONGEVITY = 1.4;
const SEED_RANGE = 10;
const MEDIA_COLOR = [1, 1, 1];
// CSS pixels
const RECT_TOLERANCE = 0.01;
const HARD_EMOJI_FRONT: EmojiFront = { radius: -1, edge: 0 };
const PREMULTIPLIED_BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
};

const instances = new Map<number, Instance>();
const framesByRenderId = new Map<string, { generation: number; frames: Map<number, GpuCanvasFrame> }>();
const colorCache = new Map<string, number[]>();
const paramsData = new ArrayBuffer(PARAMS_SIZE);
const paramsFloats = new Float32Array(paramsData);
const paramsUints = new Uint32Array(paramsData);
const sceneData = new Float32Array(SCENE_SIZE / Float32Array.BYTES_PER_ELEMENT);
const viewData = new Float32Array(VIEW_SIZE / Float32Array.BYTES_PER_ELEMENT);
const seed = Math.random() * SEED_RANGE;

let renderer: Renderer | undefined;
let rendererPromise: Promise<Renderer | undefined> | undefined;
let tile: Tile | undefined;
let colorContext: OffscreenCanvasRenderingContext2D | undefined;
let isAnimated = true;
let isPaused = false;
let maxFps: number | undefined;
let isFrameScheduled = false;
let framesInFlight = 0;
let lastFrameAt: number | undefined;
let nextFrameAt: number | undefined;

onmessage = ({ data }: MessageEvent<GpuCanvasCommand[]>) => {
  data.forEach(handleCommand);
  scheduleFrame();
};

void ensureRenderer();

function handleCommand(command: GpuCanvasCommand) {
  switch (command.type) {
    case 'create':
      instances.set(command.id, {
        kind: command.kind,
        canvas: command.canvas,
        cssWidth: 0,
        cssHeight: 0,
        dpr: 1,
        rects: [],
        isDirty: true,
        shouldUpdateRects: true,
        tileOffsetX: Math.random() * TILE_CONFIG.size,
        tileOffsetY: Math.random() * TILE_CONFIG.size,
        rectCount: 0,
        clock: 0,
        particleCount: 0,
        emojis: new Map(),
      });
      break;
    case 'resize': {
      const instance = instances.get(command.id);
      if (!instance) return;

      instance.cssWidth = command.width;
      instance.cssHeight = command.height;
      instance.dpr = command.dpr;
      instance.shouldUpdateRects = true;
      instance.isDirty = true;
      break;
    }
    case 'setSpoilers': {
      const instance = instances.get(command.id);
      if (!instance) return;
      if (instance.reveal) {
        instance.pendingRects = command.rects;
        return;
      }
      // Measuring again on scrolls and resizes keeps particles where they are
      if (getAreRectsEqual(instance.rects, command.rects)) return;

      instance.rects = command.rects;
      if (command.rects.length) instance.isRevealed = false;
      instance.shouldUpdateRects = true;
      instance.isDirty = true;
      break;
    }
    case 'reveal': {
      const instance = instances.get(command.id);
      if (!instance || instance.reveal || !hasParticles(instance) || !isAnimated) {
        command.glyphs?.close();
        if (instance && !isAnimated && hasParticles(instance)) finishReveal(instance);
        return;
      }

      instance.isDirty = true;
      instance.reveal = {
        x: command.x, y: command.y, startedAt: performance.now(), glyphs: command.glyphs,
      };
      break;
    }
    case 'setVisible': {
      const instance = instances.get(command.id);
      if (!instance) return;

      if (command.isVisible && !instance.isVisible) instance.isDirty = true;
      instance.isVisible = command.isVisible;
      break;
    }
    case 'destroy': {
      const instance = instances.get(command.id);
      if (!instance) return;

      instance.reveal?.glyphs?.close();
      destroyInstanceResources(instance);
      instance.context?.unconfigure();
      instances.delete(command.id);
      break;
    }
    case 'setEmoji': {
      const instance = instances.get(command.id);
      if (!instance) return;

      const view = instance.emojis.get(command.viewId);
      if (view?.renderId === command.renderId) {
        view.x = command.x;
        view.y = command.y;
        view.size = command.size;
      } else {
        destroyEmojiResources(view);
        instance.emojis.set(command.viewId, {
          renderId: command.renderId, x: command.x, y: command.y, size: command.size,
        });
      }
      instance.isDirty = true;
      break;
    }
    case 'drawEmoji': {
      const instance = instances.get(command.id);
      const view = instance?.emojis.get(command.viewId);
      if (!view) return;

      view.frameIndex = command.frameIndex;
      instance!.isDirty = true;
      break;
    }
    case 'removeEmoji': {
      const instance = instances.get(command.id);
      const view = instance?.emojis.get(command.viewId);
      if (!view) return;

      destroyEmojiResources(view);
      instance!.emojis.delete(command.viewId);
      instance!.isDirty = true;
      break;
    }
    case 'clearFrames':
      // Frames queued before a destroy still arrive and stay until their render id returns. A tombstone for destroyed
      // ids would free them, if that memory grows.
      if (Number.isFinite(command.generation)) {
        framesByRenderId.set(command.renderId, { generation: command.generation, frames: new Map() });
      } else {
        framesByRenderId.delete(command.renderId);
      }
      break;
    case 'dropFrame':
      framesByRenderId.get(command.renderId)?.frames.delete(command.frameIndex);
      break;
    case 'connectMediaWorker':
      command.port.onmessage = ({ data: frame }: MessageEvent<GpuCanvasFrame>) => {
        storeFrame(frame);
        scheduleFrame();
      };
      break;
    case 'setPlayback':
      isAnimated = command.isAnimated;
      isPaused = command.isPaused;
      maxFps = command.maxFps;
      break;
  }
}

// Client rects of a scrolled container can differ by rounding
function getAreRectsEqual(rects: SpoilerRect[], otherRects: SpoilerRect[]) {
  const isClose = (a: number, b: number) => Math.abs(a - b) < RECT_TOLERANCE;

  return rects.length === otherRects.length && rects.every((rect, i) => {
    const other = otherRects[i];
    return isClose(rect.x, other.x) && isClose(rect.y, other.y)
      && isClose(rect.width, other.width) && isClose(rect.height, other.height)
      && rect.density === other.density && rect.color === other.color && rect.isEmoji === other.isEmoji;
  });
}

function storeFrame(frame: GpuCanvasFrame) {
  let entry = framesByRenderId.get(frame.renderId);
  if (!entry || entry.generation < frame.generation) {
    entry = { generation: frame.generation, frames: new Map() };
    framesByRenderId.set(frame.renderId, entry);
  } else if (entry.generation > frame.generation) {
    return;
  }

  entry.frames.set(frame.frameIndex, frame);

  instances.forEach((instance) => {
    instance.emojis.forEach((view) => {
      if (view.renderId === frame.renderId && view.frameIndex === frame.frameIndex) {
        instance.isDirty = true;
      }
    });
  });
}

function ensureRenderer() {
  rendererPromise ??= createRenderer().then((result) => {
    renderer = result;
    if (!result) {
      postMessage({ type: 'unavailable' } satisfies GpuCanvasWorkerMessage);
      return undefined;
    }

    postMessage({ type: 'ready' } satisfies GpuCanvasWorkerMessage);

    void result.device.lost.then(handleDeviceLost);
    instances.forEach((instance) => {
      instance.isDirty = true;
    });
    scheduleFrame();

    return result;
  });

  return rendererPromise;
}

async function createRenderer(): Promise<Renderer | undefined> {
  const gpu = await acquireGpuDevice();
  if (!gpu) return undefined;

  const { device, format } = gpu;

  try {
    const particlesModule = device.createShaderModule({ code: particlesShader });
    const spoilerModule = device.createShaderModule({ code: spoilerShader });
    const emojiModule = device.createShaderModule({ code: emojiShader });
    const textModule = device.createShaderModule({ code: textParticlesShader });
    const textConstants = {
      FLY_DURATION: SPOILER_MORPH.fly / 1000,
      SPREAD_DURATION: SPOILER_MORPH.spread / 1000,
      JITTER_DURATION: SPOILER_MORPH.jitter / 1000,
      FADE_DURATION: SPOILER_MORPH.fade / 1000,
    };
    const [
      computePipeline, particlePipeline, spoilerPipeline, emojiPipeline,
      textAssignPipeline, textParticlePipeline,
    ] = await Promise.all([
      device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: particlesModule, entryPoint: 'simulate' },
      }),
      createQuadPipeline(device, particlesModule, TILE_FORMAT),
      createQuadPipeline(device, spoilerModule, format),
      createQuadPipeline(device, emojiModule, format),
      device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: textModule, entryPoint: 'assign', constants: textConstants },
      }),
      createQuadPipeline(device, textModule, format, textConstants),
    ]);

    return {
      ...gpu,
      computePipeline,
      particlePipeline,
      spoilerPipeline,
      emojiPipeline,
      textAssignPipeline,
      textParticlePipeline,
      emptyGlyphBuffer: device.createBuffer({ size: GLYPH_BYTES, usage: GPUBufferUsage.STORAGE }),
      tileSampler: device.createSampler({
        magFilter: 'linear', minFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat',
      }),
      emojiSampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
    };
  } catch {
    gpu.release();
    return undefined;
  }
}

function createQuadPipeline(
  device: GPUDevice, module: GPUShaderModule, format: GPUTextureFormat, constants?: Record<string, number>,
) {
  return device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: { module, entryPoint: 'vertex_main', constants },
    fragment: {
      module, entryPoint: 'fragment_main', constants, targets: [{ format, blend: PREMULTIPLIED_BLEND }],
    },
    primitive: { topology: 'triangle-strip' },
  });
}

function handleDeviceLost() {
  renderer?.release();
  renderer = undefined;
  rendererPromise = undefined;
  tile = undefined;
  instances.forEach((instance) => {
    destroyInstanceResources(instance);
    instance.context = undefined;
    instance.isDirty = true;
  });

  void ensureRenderer();
}

function scheduleFrame() {
  if (isFrameScheduled || !renderer) return;

  isFrameScheduled = true;
  requestAnimationFrame(drawFrame);
}

function drawFrame(now: number) {
  isFrameScheduled = false;
  if (!renderer) return;

  // A deadline, not the last frame, keeps the average at the cap on displays with other refresh rates
  const isTooEarly = maxFps && nextFrameAt !== undefined && now < nextFrameAt - FRAME_INTERVAL_TOLERANCE;
  if (framesInFlight >= MAX_FRAMES_IN_FLIGHT || isTooEarly) {
    scheduleFrame();
    return;
  }

  if (maxFps) {
    const interval = 1000 / maxFps;
    nextFrameAt = nextFrameAt === undefined || now - nextFrameAt > interval ? now + interval : nextFrameAt + interval;
  }

  const delta = lastFrameAt === undefined ? DEFAULT_DELTA : Math.min((now - lastFrameAt) / 1000, MAX_DELTA);
  const isPlaying = isAnimated && !isPaused;
  let isMediaUsed = false;
  let isMediaAnimated = false;
  let isTileUpdated = false;
  let isAnimating = false;

  instances.forEach((instance) => {
    if (instance.reveal && calcRevealElapsed(instance, now) >= (
      instance.kind === 'text' ? SPOILER_MORPH_DURATION : REVEAL_DURATION
    )) {
      finishReveal(instance);
    }

    if (instance.kind !== 'media' || !hasParticles(instance) || !instance.cssWidth || !instance.cssHeight) return;
    isMediaUsed = true;
    if (instance.isVisible && isPlaying) isMediaAnimated = true;
  });

  const encoder = renderer.device.createCommandEncoder();
  let hasWork = false;

  if (isMediaUsed) {
    const currentTile = ensureTile(renderer);
    if (isMediaAnimated || currentTile.shouldReset) {
      if (currentTile.shouldReset && !isPlaying) warmUpTile(renderer, currentTile);
      encodeTile(renderer, encoder, currentTile, isMediaAnimated ? delta : 0);
      isTileUpdated = true;
      hasWork = true;
    }
  }

  instances.forEach((instance) => {
    if (!instance.cssWidth || !instance.cssHeight) return;

    const withParticles = hasParticles(instance);
    const isMedia = instance.kind === 'media';
    const isPlayingHere = Boolean(instance.isVisible) && (isMedia ? isMediaAnimated : isPlaying);
    const isInstanceAnimating = withParticles && (
      Boolean(instance.reveal) || isPlayingHere || calcAppearProgress(instance, now) < 1
    );
    // A hidden canvas gets the current tile once it becomes visible
    const isInstanceTileUpdated = withParticles && isMedia && Boolean(instance.isVisible) && isTileUpdated;
    if (!instance.isDirty && !isInstanceAnimating && !isInstanceTileUpdated) return;

    if (isMedia) {
      encodeInstance(renderer!, encoder, instance, ensureTile(renderer!), now);
    } else {
      encodeTextInstance(renderer!, encoder, instance, now, isPlayingHere || instance.reveal ? delta : 0);
    }
    instance.isDirty = false;
    hasWork = true;
    isAnimating ||= isInstanceAnimating;
  });

  if (hasWork) {
    renderer.device.queue.submit([encoder.finish()]);
    framesInFlight++;
    void renderer.device.queue.onSubmittedWorkDone().finally(() => {
      framesInFlight--;
    });
  }

  lastFrameAt = isAnimating ? now : undefined;
  if (!isAnimating) nextFrameAt = undefined;
  if (isAnimating) scheduleFrame();
}

function calcAppearProgress({ appearedAt }: Instance, now: number) {
  if (!isAnimated) return 1;
  if (appearedAt === undefined) return 0;

  return Math.min((now - appearedAt) / APPEAR_DURATION, 1);
}

function hasParticles(instance: Instance) {
  return !instance.isRevealed && (instance.kind === 'media' || instance.rects.length > 0);
}

// Text particles of a morph follow the clock, which can fall behind while a canvas is hidden
function calcRevealElapsed({ kind, reveal, clock }: Instance, now: number) {
  if (kind === 'media') return now - reveal!.startedAt;

  return reveal!.anchorClock === undefined ? 0 : (clock - reveal!.anchorClock) * 1000;
}

function finishReveal(instance: Instance) {
  const { reveal, pendingRects } = instance;
  reveal?.glyphs?.close();
  reveal?.glyphTexture?.destroy();
  instance.glyphBuffer?.destroy();
  instance.glyphBuffer = undefined;
  instance.textRenderBindGroup = undefined;
  instance.reveal = undefined;
  instance.pendingRects = undefined;
  instance.isDirty = true;
  instance.rects = pendingRects || [];
  instance.isRevealed = !instance.rects.length;
  instance.shouldUpdateRects = true;
}

// The tile follows the largest pixel ratio, so it stays sharp on every screen
function ensureTile(gpu: Renderer) {
  let maxDpr = 1;
  instances.forEach(({ dpr }) => {
    maxDpr = Math.max(maxDpr, dpr);
  });

  const config = TILE_CONFIG;
  const size = Math.round(config.size * maxDpr);
  const current = tile;
  if (current?.size === size) return current;

  const { device } = gpu;
  current?.texture.destroy();
  current?.particles.destroy();
  current?.uniform.destroy();

  const particleCount = Math.ceil((config.size * config.size * config.density) / WORKGROUP_SIZE) * WORKGROUP_SIZE;
  const particles = device.createBuffer({ size: particleCount * PARTICLE_STRIDE, usage: GPUBufferUsage.STORAGE });
  const uniform = device.createBuffer({ size: PARAMS_SIZE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

  tile = {
    size,
    scale: size / config.size,
    particleCount,
    texture: device.createTexture({
      size: [size, size],
      format: TILE_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    }),
    particles,
    uniform,
    computeBindGroup: device.createBindGroup({
      layout: gpu.computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        { binding: 1, resource: { buffer: particles } },
      ],
    }),
    renderBindGroup: device.createBindGroup({
      layout: gpu.particlePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        { binding: 1, resource: { buffer: particles } },
      ],
    }),
    time: 0,
    frameIndex: 0,
    shouldReset: true,
  };

  return tile;
}

function encodeTile(gpu: Renderer, encoder: GPUCommandEncoder, currentTile: Tile, delta: number) {
  writeTileParams(gpu.device, currentTile, delta);
  encodeTileSimulation(gpu, encoder, currentTile);

  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: currentTile.texture.createView(),
      clearValue: [0, 0, 0, 0],
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });
  pass.setPipeline(gpu.particlePipeline);
  pass.setBindGroup(0, currentTile.renderBindGroup);
  pass.draw(4, currentTile.particleCount * COPIES_PER_PARTICLE);
  pass.end();
}

function encodeTileSimulation(gpu: Renderer, encoder: GPUCommandEncoder, currentTile: Tile) {
  const pass = encoder.beginComputePass();
  pass.setPipeline(gpu.computePipeline);
  pass.setBindGroup(0, currentTile.computeBindGroup);
  pass.dispatchWorkgroups(currentTile.particleCount / WORKGROUP_SIZE);
  pass.end();
  currentTile.shouldReset = false;
}

// Simulates the effect for a while, so the single frame drawn without animations looks settled
function warmUpTile(gpu: Renderer, currentTile: Tile) {
  for (let i = 0; i < STATIC_STEPS; i++) {
    writeTileParams(gpu.device, currentTile, DEFAULT_DELTA);
    const encoder = gpu.device.createCommandEncoder();
    encodeTileSimulation(gpu, encoder, currentTile);
    gpu.device.queue.submit([encoder.finish()]);
  }
}

function writeTileParams(device: GPUDevice, currentTile: Tile, delta: number) {
  if (currentTile.shouldReset) currentTile.time = 0;
  currentTile.time += delta;

  const { particleSize } = TILE_CONFIG;
  paramsFloats.set([currentTile.size, currentTile.size, particleSize * currentTile.scale, currentTile.scale], 0);
  paramsFloats.set([currentTile.time, delta, seed, NOISE_SCALE], 4);
  paramsFloats.set([NOISE_SPEED, NOISE_MOVEMENT, FORCE_MULTIPLIER, DAMPING], 8);
  paramsFloats.set([VELOCITY_MULTIPLIER, MAX_VELOCITY, LONGEVITY, 0], 12);
  paramsUints.set([currentTile.particleCount, currentTile.shouldReset ? 1 : 0, currentTile.frameIndex++, 0], 16);
  device.queue.writeBuffer(currentTile.uniform, 0, paramsData);
}

function encodeInstance(gpu: Renderer, encoder: GPUCommandEncoder, instance: Instance, currentTile: Tile, now: number) {
  const { device } = gpu;
  const context = ensureContext(gpu, instance);
  if (!context) return;

  const { canvas, reveal } = instance;
  const scale = canvas.width / instance.cssWidth;
  const withParticles = hasParticles(instance);
  if (instance.shouldUpdateRects) updateRects(gpu, instance, scale);
  if (withParticles) instance.appearedAt ??= now;

  instance.scene ??= device.createBuffer({ size: SCENE_SIZE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const revealProgress = reveal ? Math.min((now - reveal.startedAt) / REVEAL_DURATION, 1) ** 2 : 0;
  sceneData.set([
    canvas.width,
    canvas.height,
    scale,
    0,
    (reveal?.x ?? 0) * scale,
    (reveal?.y ?? 0) * scale,
    reveal ? revealProgress * calcRevealMaxRadius(instance, reveal.x, reveal.y) * MEDIA_REVEAL_OVERSHOOT * scale : -1,
    RIPPLE_RING * scale,
    instance.tileOffsetX * currentTile.scale,
    instance.tileOffsetY * currentTile.scale,
    currentTile.scale,
    currentTile.size,
    calcAppearProgress(instance, now),
  ]);
  device.queue.writeBuffer(instance.scene, 0, sceneData);

  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: [0, 0, 0, 0],
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });

  if (instance.emojis.size) encodeEmojis(gpu, pass, instance, scale, HARD_EMOJI_FRONT);

  if (withParticles && instance.rectCount) {
    if (instance.spoilerBindGroupTile !== currentTile) {
      instance.spoilerBindGroup = device.createBindGroup({
        layout: gpu.spoilerPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: instance.scene } },
          { binding: 1, resource: currentTile.texture.createView() },
          { binding: 2, resource: gpu.tileSampler },
          { binding: 3, resource: { buffer: instance.rectBuffer! } },
        ],
      });
      instance.spoilerBindGroupTile = currentTile;
    }

    pass.setPipeline(gpu.spoilerPipeline);
    pass.setBindGroup(0, instance.spoilerBindGroup!);
    pass.draw(4, instance.rectCount);
  }

  pass.end();
}

function encodeTextInstance(
  gpu: Renderer, encoder: GPUCommandEncoder, instance: Instance, now: number, delta: number,
) {
  const { device } = gpu;
  const context = ensureContext(gpu, instance);
  if (!context) return;

  const { canvas, reveal } = instance;
  const scale = canvas.width / instance.cssWidth;
  const withParticles = hasParticles(instance);
  if (instance.shouldUpdateRects) updateRects(gpu, instance, scale);
  if (withParticles) instance.appearedAt ??= now;

  instance.clock += delta;
  if (reveal) reveal.anchorClock ??= instance.clock;

  const maxRadius = reveal ? calcRevealMaxRadius(instance, reveal.x, reveal.y) * scale : 0;
  const emojiFront = reveal
    ? calcEmojiFront((instance.clock - reveal.anchorClock!) * 1000, maxRadius)
    : HARD_EMOJI_FRONT;
  instance.scene ??= device.createBuffer({ size: SCENE_SIZE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  sceneData.set([
    canvas.width,
    canvas.height,
    scale,
    SPOILER_EDGE_FADE * scale,
    (reveal?.x ?? 0) * scale,
    (reveal?.y ?? 0) * scale,
    emojiFront.radius,
    maxRadius,
    reveal ? reveal.anchorClock! : -1,
    0,
    instance.clock,
    reveal && (reveal.glyphs || instance.glyphBuffer) ? 1 : 0,
    calcAppearProgress(instance, now),
    instance.particleCount,
    seed,
    TEXT_PARTICLE_SIZE * scale,
  ]);
  device.queue.writeBuffer(instance.scene, 0, sceneData);

  const withParticleDraw = withParticles && instance.particleCount > 0;
  if (withParticleDraw && reveal?.glyphs) encodeGlyphAssignment(gpu, encoder, instance, scale);

  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: [0, 0, 0, 0],
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });

  if (instance.emojis.size) encodeEmojis(gpu, pass, instance, scale, emojiFront);

  if (withParticleDraw) {
    instance.textRenderBindGroup ??= device.createBindGroup({
      layout: gpu.textParticlePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: instance.scene } },
        { binding: 1, resource: { buffer: instance.glyphBuffer ?? gpu.emptyGlyphBuffer } },
        { binding: 2, resource: { buffer: instance.rectBuffer! } },
      ],
    });
    pass.setPipeline(gpu.textParticlePipeline);
    pass.setBindGroup(0, instance.textRenderBindGroup);
    pass.draw(4, instance.particleCount);
  }

  pass.end();
}

// Custom emoji appear and disappear behind the same soft front as the text, see `buildMorphStyle`
function calcEmojiFront(elapsed: number, maxRadius: number): EmojiFront {
  const edge = (SPOILER_MORPH.fade / SPOILER_MORPH.spread) * maxRadius;
  const delay = SPOILER_MORPH.fly + SPOILER_MORPH.jitter / 2;
  const progress = Math.min(Math.max((elapsed - delay) / (SPOILER_MORPH.spread + SPOILER_MORPH.fade), 0), 1);

  return { radius: progress * (maxRadius + edge), edge };
}

// Sends each particle to its nearest glyph pixel in the first frame of a reveal
function encodeGlyphAssignment(gpu: Renderer, encoder: GPUCommandEncoder, instance: Instance, scale: number) {
  const { device } = gpu;
  const reveal = instance.reveal!;
  const glyphs = reveal.glyphs!;
  reveal.glyphs = undefined;

  // The format of the canvas lets custom emoji be drawn in with their pipeline
  reveal.glyphTexture = device.createTexture({
    size: [glyphs.width, glyphs.height],
    format: gpu.format,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: glyphs },
    { texture: reveal.glyphTexture, premultipliedAlpha: true },
    [glyphs.width, glyphs.height],
  );
  glyphs.close();
  if (instance.emojis.size) drawGlyphEmojis(gpu, instance, scale, reveal.glyphTexture);

  instance.glyphBuffer = device.createBuffer({
    size: instance.particleCount * GLYPH_BYTES,
    usage: GPUBufferUsage.STORAGE,
  });
  instance.textRenderBindGroup = undefined;

  const pass = encoder.beginComputePass();
  pass.setPipeline(gpu.textAssignPipeline);
  pass.setBindGroup(0, device.createBindGroup({
    layout: gpu.textAssignPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: instance.scene! } },
      { binding: 1, resource: { buffer: instance.glyphBuffer } },
      { binding: 2, resource: { buffer: instance.rectBuffer! } },
      { binding: 3, resource: reveal.glyphTexture.createView() },
    ],
  }));
  pass.dispatchWorkgroups(Math.ceil(instance.particleCount / TEXT_WORKGROUP_SIZE));
  pass.end();
}

// Adds the concealed custom emoji to the glyphs, so particles take their colors. It is submitted at once,
// as the frame rewrites the view uniforms.
function drawGlyphEmojis(gpu: Renderer, instance: Instance, scale: number, texture: GPUTexture) {
  const encoder = gpu.device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{ view: texture.createView(), loadOp: 'load', storeOp: 'store' }],
  });
  encodeEmojis(gpu, pass, instance, scale, HARD_EMOJI_FRONT, true);
  pass.end();
  gpu.device.queue.submit([encoder.finish()]);
}

function ensureContext(gpu: Renderer, instance: Instance) {
  const { canvas } = instance;
  const maxSize = gpu.device.limits.maxTextureDimension2D;
  const dpr = Math.min(instance.dpr, maxSize / instance.cssWidth, maxSize / instance.cssHeight);
  const width = Math.max(1, Math.round(instance.cssWidth * dpr));
  const height = Math.max(1, Math.round(instance.cssHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    instance.shouldUpdateRects = true;
  }

  if (!instance.context) {
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
      postMessage({ type: 'unavailable' } satisfies GpuCanvasWorkerMessage);
      return undefined;
    }

    context.configure({ device: gpu.device, format: gpu.format, alphaMode: 'premultiplied' });
    instance.context = context;
  }

  return instance.context;
}

function updateRects(gpu: Renderer, instance: Instance, scale: number) {
  instance.shouldUpdateRects = false;

  const rects: SpoilerRect[] = instance.kind === 'media'
    ? [{
      x: 0, y: 0, width: instance.cssWidth, height: instance.cssHeight, density: 1, color: '',
    }]
    // Emoji markers only conceal, they have no particles to draw
    : instance.rects.filter((rect) => !rect.isEmoji);
  const data = new Float32Array(Math.max(rects.length, 1) * RECT_FLOATS);
  let particleCount = 0;
  rects.forEach((rect, i) => {
    const isText = instance.kind === 'text';
    // Text particles of a rect are counted by its area and density, and its last value is the index of the first one
    const last = isText ? particleCount : rect.density;
    if (isText) particleCount = Math.min(particleCount + calcTextParticleCount(rect), MAX_TEXT_PARTICLES);
    data.set([
      rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale,
      ...(isText ? parseColor(rect.color) : MEDIA_COLOR), last,
    ], i * RECT_FLOATS);
  });

  if (instance.rectBuffer?.size !== data.byteLength) {
    instance.rectBuffer?.destroy();
    instance.rectBuffer = gpu.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    instance.spoilerBindGroupTile = undefined;
  }

  gpu.device.queue.writeBuffer(instance.rectBuffer, 0, data);
  instance.rectCount = rects.length;
  instance.particleCount = particleCount;
  instance.textRenderBindGroup = undefined;
}

function calcTextParticleCount(rect: SpoilerRect) {
  return Math.round((rect.width + SPOILER_EDGE_FADE) * (rect.height + SPOILER_EDGE_FADE) * TEXT_DENSITY * rect.density);
}

function parseColor(color: string) {
  let result = colorCache.get(color);
  if (result) return result;

  colorContext ??= new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })!;
  colorContext.clearRect(0, 0, 1, 1);
  colorContext.fillStyle = color;
  colorContext.fillRect(0, 0, 1, 1);
  const [red, green, blue] = colorContext.getImageData(0, 0, 1, 1).data;
  result = [red / COLOR_CHANNEL_MAX, green / COLOR_CHANNEL_MAX, blue / COLOR_CHANNEL_MAX];
  colorCache.set(color, result);

  return result;
}

// The glyph pass draws only the concealed emoji, unmasked
function encodeEmojis(
  gpu: Renderer,
  pass: GPURenderPassEncoder,
  instance: Instance,
  scale: number,
  front: EmojiFront,
  isGlyphPass?: boolean,
) {
  const { device } = gpu;
  const withParticles = hasParticles(instance);

  instance.emojiBindGroup ??= device.createBindGroup({
    layout: gpu.emojiPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: instance.scene! } },
      { binding: 1, resource: gpu.emojiSampler },
    ],
  });

  pass.setPipeline(gpu.emojiPipeline);
  pass.setBindGroup(0, instance.emojiBindGroup);

  instance.emojis.forEach((view) => {
    if (!uploadEmojiFrame(gpu, view)) return;

    const x = view.x * instance.cssWidth;
    const y = view.y * instance.cssHeight;
    const isConcealed = withParticles && getIsConcealed(instance.rects, x, y, view.size);
    if (isGlyphPass && !isConcealed) return;

    // Edges on device pixels keep the frame from being resampled
    const left = Math.round(x * scale);
    const top = Math.round(y * scale);
    viewData.set([
      left,
      top,
      Math.round((x + view.size) * scale) - left,
      Math.round((y + view.size) * scale) - top,
      isConcealed && !isGlyphPass ? 1 : 0,
      front.edge,
      0,
      0,
    ]);
    device.queue.writeBuffer(view.uniform!, 0, viewData);
    pass.setBindGroup(1, view.bindGroup!);
    pass.draw(4);
  });
}

// Spoilers mark their emoji where the emoji is drawn. The center is tested, as the drawn size can exceed
// the laid out one, such as with a small message text size.
function getIsConcealed(rects: SpoilerRect[], x: number, y: number, size: number) {
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  return rects.some((rect) => (
    rect.isEmoji
    && rect.x <= centerX && centerX <= rect.x + rect.width
    && rect.y <= centerY && centerY <= rect.y + rect.height
  ));
}

// Returns whether the view has a frame to draw
function uploadEmojiFrame(gpu: Renderer, view: EmojiView) {
  const frame = view.frameIndex !== undefined
    ? framesByRenderId.get(view.renderId)?.frames.get(view.frameIndex)
    : undefined;
  if (!frame || frame === view.drawnFrame) return Boolean(view.drawnFrame && view.texture);

  const { device } = gpu;
  if (!view.texture || view.texture.width !== frame.size) {
    view.texture?.destroy();
    view.texture = device.createTexture({
      size: [frame.size, frame.size],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    view.uniform ??= device.createBuffer({ size: VIEW_SIZE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    view.bindGroup = device.createBindGroup({
      layout: gpu.emojiPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: view.uniform } },
        { binding: 1, resource: view.texture.createView() },
      ],
    });
  }

  device.queue.writeTexture(
    { texture: view.texture },
    frame.pixels,
    { bytesPerRow: frame.size * BYTES_PER_PIXEL },
    [frame.size, frame.size],
  );
  view.drawnFrame = frame;

  return true;
}

function calcRevealMaxRadius({ cssWidth, cssHeight }: Instance, originX: number, originY: number) {
  const x = Math.max(originX, cssWidth - originX);
  const y = Math.max(originY, cssHeight - originY);

  return Math.hypot(x, y);
}

function destroyInstanceResources(instance: Instance) {
  instance.rectBuffer?.destroy();
  instance.scene?.destroy();
  instance.glyphBuffer?.destroy();
  instance.reveal?.glyphTexture?.destroy();
  instance.rectBuffer = undefined;
  instance.scene = undefined;
  instance.glyphBuffer = undefined;
  instance.particleCount = 0;
  instance.textRenderBindGroup = undefined;
  if (instance.reveal) instance.reveal.glyphTexture = undefined;
  instance.spoilerBindGroup = undefined;
  instance.spoilerBindGroupTile = undefined;
  instance.emojiBindGroup = undefined;
  instance.shouldUpdateRects = true;
  instance.emojis.forEach((view) => {
    destroyEmojiResources(view);
    view.drawnFrame = undefined;
  });
}

function destroyEmojiResources(view?: EmojiView) {
  if (!view) return;

  view.texture?.destroy();
  view.uniform?.destroy();
  view.texture = undefined;
  view.uniform = undefined;
  view.bindGroup = undefined;
}
