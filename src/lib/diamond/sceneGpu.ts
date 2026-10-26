import type {
  DiamondDrawState, DiamondPalette, DiamondPose, DiamondViewport,
} from './model';
import type { StarBurst } from './stars';

import sceneShader from './shaders/scene.wgsl?raw';
import starShader from './shaders/stars.wgsl?raw';
import {
  createPoseSolver, DIAMOND_ATTRIBUTE_COUNT, FLOAT_SIZE, loadModel, PALETTE_IDS, PLANE_COUNT, REFRACTION,
  SMALL_SPARKLE_COUNT, SPARKLE_ATTRIBUTE_COUNT, SPARKLE_HALO_SCALE_INDEX, SPARKLE_SHAPE_OFFSET, VEC4_SIZE,
} from './model';
import { getStarCount, STAR_CORNER_COUNT } from './stars';

// The diamond scene and the salute. A pass draws into one canvas, and every canvas has targets of
// its own: the uniform writes of a frame all land before its commands run, so a shared buffer would hold the last pose.

export type GpuDiamondTarget = {
  buffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  data: Float32Array<ArrayBuffer>;
};

export type GpuDiamondScene = {
  createTarget: (palette: DiamondPalette) => GpuDiamondTarget;
  // The pose is reused by the next call, so it goes to a target before another one is solved
  solve: (state: DiamondDrawState, time: number, frameTime: number, yaw: number, pitch: number) => DiamondPose;
  writeTarget: (target: GpuDiamondTarget, pose: DiamondPose, viewport: DiamondViewport, time: number) => void;
  // Draws a written target; the viewport counts from the top left corner
  encode: (pass: GPURenderPassEncoder, target: GpuDiamondTarget, viewport: DiamondViewport) => void;
  draw: (
    pass: GPURenderPassEncoder, target: GpuDiamondTarget, state: DiamondDrawState, viewport: DiamondViewport,
    time: number, frameTime: number, yaw: number, pitch: number,
  ) => void;
};

export type GpuStarRenderer = {
  createTarget: () => GpuDiamondTarget;
  draw: (
    pass: GPURenderPassEncoder, target: GpuDiamondTarget, viewport: DiamondViewport, bursts: StarBurst[],
    time: number, opacity: number, burstSize: number,
  ) => void;
};

type Mesh = {
  buffer: GPUBuffer;
  vertexCount: number;
};

export const SAMPLE_COUNT = 4;
export const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';

const BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
};

// Float offsets in `Uniforms` of `scene.wgsl`
const UNIFORM_FLOATS = 116;
const PROJECTION_OFFSET = 16;
const INVERSE_MODEL_OFFSET = 32;
const PARAMETERS_OFFSET = 48;
const VIEWPORT_OFFSET = 52;
const SPARKLE_SHAPE_UNIFORM_OFFSET = 56;
const SPARKLE_HALO_OFFSET = 60;
// The first three sweeps of the frame come before `facetProjection`, the other six after it
const LEADING_SWEEPS_OFFSET = 64;
const LEADING_SWEEP_FLOATS = 12;
const FACET_PROJECTION_OFFSET = 76;
const TRAILING_SWEEPS_OFFSET = 80;
const APPEARANCE_OFFSET = 104;

// As many salutes as a standalone diamond keeps, and as `Salutes` of `stars.wgsl` holds
const MAX_BURSTS = 3;

export async function createGpuDiamondScene(device: GPUDevice, format: GPUTextureFormat): Promise<GpuDiamondScene> {
  const module = device.createShaderModule({ code: sceneShader });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [0, 1].map((binding) => ({
      binding,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: {},
    })),
  });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

  const [model, diamondPipeline, sparklePipeline] = await Promise.all([
    loadModel(),
    device.createRenderPipelineAsync({
      layout,
      vertex: { module, entryPoint: 'diamondVertex', buffers: [buildVertexLayout(DIAMOND_ATTRIBUTE_COUNT)] },
      fragment: { module, entryPoint: 'diamondFragment', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less-equal' },
      multisample: { count: SAMPLE_COUNT },
    }),
    device.createRenderPipelineAsync({
      layout,
      vertex: { module, entryPoint: 'sparkleVertex', buffers: [buildVertexLayout(SPARKLE_ATTRIBUTE_COUNT)] },
      fragment: { module, entryPoint: 'sparkleFragment', targets: [{ format, blend: BLEND }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'always' },
      multisample: { count: SAMPLE_COUNT },
    }),
  ]);

  const diamond = createMesh(device, model.vertices, DIAMOND_ATTRIBUTE_COUNT);
  const mainSparkle = createMesh(device, model.mainSparkle, SPARKLE_ATTRIBUTE_COUNT);
  const smallSparkles = createMesh(device, model.smallSparkles, SPARKLE_ATTRIBUTE_COUNT);
  const hull = createBuffer(device, GPUBufferUsage.UNIFORM, [model.planes, model.anchors]);
  const solvePose = createPoseSolver(model);

  function createTarget(palette: DiamondPalette): GpuDiamondTarget {
    const data = new Float32Array(UNIFORM_FLOATS);
    data.set(model.facetProjection, FACET_PROJECTION_OFFSET);
    data[APPEARANCE_OFFSET] = PALETTE_IDS[palette];

    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer } }, { binding: 1, resource: { buffer: hull } }],
    });

    return { buffer, bindGroup, data };
  }

  function writeTarget(target: GpuDiamondTarget, pose: DiamondPose, { size }: DiamondViewport, time: number) {
    const { frame } = pose;
    const { data } = target;

    data.set(pose.modelMatrix);
    data.set(pose.projection, PROJECTION_OFFSET);
    data.set(pose.inverseModelMatrix, INVERSE_MODEL_OFFSET);
    setVector(data, PARAMETERS_OFFSET, time, REFRACTION, 1, 1);
    setVector(data, VIEWPORT_OFFSET, size, size, PLANE_COUNT, 0);
    data.set(frame.subarray(SPARKLE_SHAPE_OFFSET, SPARKLE_SHAPE_OFFSET + VEC4_SIZE), SPARKLE_SHAPE_UNIFORM_OFFSET);
    setVector(
      data, SPARKLE_HALO_OFFSET, frame[SPARKLE_HALO_SCALE_INDEX], pose.anchor, pose.widthScale, pose.sparkleVisibility,
    );
    data.set(frame.subarray(0, LEADING_SWEEP_FLOATS), LEADING_SWEEPS_OFFSET);
    data.set(frame.subarray(LEADING_SWEEP_FLOATS, SPARKLE_SHAPE_OFFSET), TRAILING_SWEEPS_OFFSET);
    device.queue.writeBuffer(target.buffer, 0, data);
  }

  function encode(pass: GPURenderPassEncoder, target: GpuDiamondTarget, { x, y, size }: DiamondViewport) {
    pass.setViewport(x, y, size, size, 0, 1);
    pass.setBindGroup(0, target.bindGroup);
    pass.setPipeline(diamondPipeline);
    pass.setVertexBuffer(0, diamond.buffer);
    pass.draw(diamond.vertexCount);

    pass.setPipeline(sparklePipeline);
    pass.setVertexBuffer(0, mainSparkle.buffer);
    pass.draw(mainSparkle.vertexCount, 1, 0, 0);
    pass.setVertexBuffer(0, smallSparkles.buffer);
    pass.draw(smallSparkles.vertexCount, SMALL_SPARKLE_COUNT, 0, 1);
  }

  function draw(
    pass: GPURenderPassEncoder, target: GpuDiamondTarget, state: DiamondDrawState, viewport: DiamondViewport,
    time: number, frameTime: number, yaw: number, pitch: number,
  ) {
    writeTarget(target, solvePose(state, time, frameTime, yaw, pitch), viewport, time);
    encode(pass, target, viewport);
  }

  return {
    createTarget, solve: solvePose, writeTarget, encode, draw,
  };
}

// The stars are blended over the cleared canvas and leave the depth buffer to the diamond drawn next
export async function createGpuStarRenderer(device: GPUDevice, format: GPUTextureFormat): Promise<GpuStarRenderer> {
  const module = device.createShaderModule({ code: starShader });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }],
  });
  const pipeline = await device.createRenderPipelineAsync({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: { module, entryPoint: 'starVertex' },
    fragment: { module, entryPoint: 'starFragment', targets: [{ format, blend: BLEND }] },
    primitive: { topology: 'triangle-list' },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'always' },
    multisample: { count: SAMPLE_COUNT },
  });

  function createTarget(): GpuDiamondTarget {
    const data = new Float32Array(MAX_BURSTS * VEC4_SIZE);
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer } }],
    });

    return { buffer, bindGroup, data };
  }

  function draw(
    pass: GPURenderPassEncoder, target: GpuDiamondTarget, { x, y, size }: DiamondViewport, bursts: StarBurst[],
    time: number, opacity: number, burstSize: number,
  ) {
    const count = getStarCount(burstSize);
    const { data } = target;

    bursts.forEach(({ startTime, seed }, i) => {
      setVector(data, i * VEC4_SIZE, time - startTime, opacity, seed, count);
    });
    device.queue.writeBuffer(target.buffer, 0, data);

    pass.setViewport(x, y, size, size, 0, 1);
    pass.setBindGroup(0, target.bindGroup);
    pass.setPipeline(pipeline);
    pass.draw(STAR_CORNER_COUNT, count * bursts.length);
  }

  return { createTarget, draw };
}

function buildVertexLayout(attributeCount: number): GPUVertexBufferLayout {
  return {
    arrayStride: attributeCount * VEC4_SIZE * FLOAT_SIZE,
    attributes: Array.from({ length: attributeCount }, (_, i) => ({
      shaderLocation: i,
      offset: i * VEC4_SIZE * FLOAT_SIZE,
      format: 'float32x4' as const,
    })),
  };
}

function createMesh(device: GPUDevice, data: Float32Array, attributeCount: number): Mesh {
  return {
    buffer: createBuffer(device, GPUBufferUsage.VERTEX, [data]),
    vertexCount: data.length / (attributeCount * VEC4_SIZE),
  };
}

function createBuffer(device: GPUDevice, usage: GPUBufferUsageFlags, parts: Float32Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const buffer = device.createBuffer({ size: length * FLOAT_SIZE, usage, mappedAtCreation: true });
  const mapped = new Float32Array(buffer.getMappedRange());

  let offset = 0;
  parts.forEach((part) => {
    mapped.set(part, offset);
    offset += part.length;
  });
  buffer.unmap();

  return buffer;
}

function setVector(data: Float32Array, offset: number, x: number, y: number, z: number, w: number) {
  data[offset] = x;
  data[offset + 1] = y;
  data[offset + 2] = z;
  data[offset + 3] = w;
}
