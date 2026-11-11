import type { DiamondPose, DiamondViewport } from './model';

import { clamp } from '../../util/math';
import lensShader from './shaders/lens.wgsl?raw';
import { DIAMOND_ATTRIBUTE_COUNT, loadModel, VEC4_SIZE } from './model';
import {
  BLEND, DEPTH_FORMAT, SAMPLE_COUNT, setVector,
} from './sceneGpu';

// The text under a grown diamond, seen through it. The stone is opaque, so the glyphs under it are drawn once more over
// it, inside its silhouette, bent by its facets and faded as if behind the glass.

export type DiamondLens = {
  // The glyphs at the canvas resolution, drawn for the canvas without `textShift`
  text: HTMLCanvasElement;
  // Changes whenever `text` is redrawn
  textVersion: number;
  // CSS pixels by which the canvas is moved sideways from where the glyphs are drawn for
  textShift: number;
  // 0..1
  strength: number;
};

export type GpuLensTarget = {
  buffer: GPUBuffer;
  texture: GPUTexture;
  bindGroup: GPUBindGroup;
  data: Float32Array<ArrayBuffer>;
  textVersion?: number;
  destroy: NoneToVoidFunction;
};

export type GpuLensRenderer = {
  // Device pixels of the square canvas
  createTarget: (size: number) => GpuLensTarget;
  draw: (
    pass: GPURenderPassEncoder, target: GpuLensTarget, lens: DiamondLens, pose: DiamondPose, viewport: DiamondViewport,
    pixelRatio: number, yaw: number,
  ) => void;
};

// As many points as `Lens` of `lens.wgsl` holds, two per item
const MAX_HULL_POINTS = 48;
const FRAME_OFFSET = MAX_HULL_POINTS * 2;
const SHAPE_OFFSET = FRAME_OFFSET + VEC4_SIZE;
const TEXT_OFFSET = SHAPE_OFFSET + VEC4_SIZE;
const UNIFORM_FLOATS = TEXT_OFFSET + VEC4_SIZE;
const VERTEX_FLOATS = DIAMOND_ATTRIBUTE_COUNT * VEC4_SIZE;
// Model vertices closer than 1/14 merge, which leaves about 300 points to find the silhouette from
const OUTLINE_GRID = 14;
// The lens is slightly narrower than the stone, so its edge hides under the rim
const HULL_SHRINK = 0.96;
const OPACITY = 0.55;
const TRIANGLE_VERTEX_COUNT = 3;
// x, y and z of an outline point
const OUTLINE_STRIDE = 3;
// A turn is checked against the last two points of the hull
const MIN_TURN_POINTS = 2;

export async function createGpuLensRenderer(device: GPUDevice, format: GPUTextureFormat): Promise<GpuLensRenderer> {
  const module = device.createShaderModule({ code: lensShader });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ],
  });
  const [model, pipeline] = await Promise.all([
    loadModel(),
    device.createRenderPipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: 'lensVertex' },
      fragment: { module, entryPoint: 'lensFragment', targets: [{ format, blend: BLEND }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'always' },
      multisample: { count: SAMPLE_COUNT },
    }),
  ]);
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const outline = buildOutline(model.vertices);
  const pointCount = outline.length / OUTLINE_STRIDE;
  const projected = new Float32Array(pointCount * 2);
  // Stays sorted from the previous frame, so sorting again is quick
  const order = Array.from({ length: pointCount }, (_, i) => i);
  const hull: number[] = [];
  // Left, top, right, bottom of the written silhouette in CSS pixels
  const bounds = [0, 0, 0, 0];

  function createTarget(size: number): GpuLensTarget {
    const data = new Float32Array(UNIFORM_FLOATS);
    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const texture = device.createTexture({
      size: [size, size],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer } },
        { binding: 1, resource: texture.createView() },
        { binding: 2, resource: sampler },
      ],
    });

    return {
      buffer,
      texture,
      bindGroup,
      data,
      destroy: () => {
        buffer.destroy();
        texture.destroy();
      },
    };
  }

  function draw(
    pass: GPURenderPassEncoder, target: GpuLensTarget, lens: DiamondLens, pose: DiamondPose, viewport: DiamondViewport,
    pixelRatio: number, yaw: number,
  ) {
    const { data, texture } = target;

    // A canvas resized after its text was drawn waits for the text of its new size
    if (target.textVersion !== lens.textVersion && lens.text.width === texture.width) {
      device.queue.copyExternalImageToTexture(
        { source: lens.text }, { texture, premultipliedAlpha: true }, [texture.width, texture.height],
      );
      target.textVersion = lens.textVersion;
    }

    const canvasSize = texture.width / pixelRatio;
    const center = canvasSize / 2;
    const count = writeHull(data, pose, viewport, pixelRatio, center);
    setVector(data, FRAME_OFFSET, center, center, canvasSize, canvasSize);
    setVector(data, SHAPE_OFFSET, pixelRatio, lens.strength, yaw, count);
    setVector(data, TEXT_OFFSET, lens.textShift, OPACITY * lens.strength, 0, 0);
    device.queue.writeBuffer(target.buffer, 0, data);

    // Only the pixels around the silhouette run the shader
    const left = clamp(Math.floor(bounds[0] * pixelRatio), 0, texture.width);
    const top = clamp(Math.floor(bounds[1] * pixelRatio), 0, texture.height);
    const right = clamp(Math.ceil(bounds[2] * pixelRatio), left, texture.width);
    const bottom = clamp(Math.ceil(bounds[3] * pixelRatio), top, texture.height);

    pass.setViewport(0, 0, texture.width, texture.height, 0, 1);
    pass.setScissorRect(left, top, right - left, bottom - top);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, target.bindGroup);
    pass.draw(TRIANGLE_VERTEX_COUNT);
  }

  // Returns the count of points written
  function writeHull(
    data: Float32Array, { modelMatrix: m, projection: p }: DiamondPose, { x, y, size }: DiamondViewport,
    pixelRatio: number, center: number,
  ) {
    for (let i = 0; i < pointCount; i++) {
      const px = outline[i * OUTLINE_STRIDE];
      const py = outline[i * OUTLINE_STRIDE + 1];
      const pz = outline[i * OUTLINE_STRIDE + 2];
      // The model matrix is a pure rotation
      const wx = m[0] * px + m[4] * py + m[8] * pz;
      const wy = m[1] * px + m[5] * py + m[9] * pz;
      const wz = m[2] * px + m[6] * py + m[10] * pz;
      const w = p[3] * wx + p[7] * wy + p[11] * wz + p[15];
      const ndcX = (p[0] * wx + p[4] * wy + p[8] * wz + p[12]) / w;
      const ndcY = (p[1] * wx + p[5] * wy + p[9] * wz + p[13]) / w;
      projected[i * 2] = (x + ((ndcX + 1) * size) / 2) / pixelRatio;
      projected[i * 2 + 1] = (y + ((1 - ndcY) * size) / 2) / pixelRatio;
    }

    buildHull();

    const count = Math.min(MAX_HULL_POINTS, hull.length);
    bounds.fill(center);

    for (let i = 0; i < count; i++) {
      const point = hull[Math.floor((i * hull.length) / count)];
      const pointX = center + (projected[point * 2] - center) * HULL_SHRINK;
      const pointY = center + (projected[point * 2 + 1] - center) * HULL_SHRINK;
      data[i * 2] = pointX;
      data[i * 2 + 1] = pointY;
      bounds[0] = Math.min(bounds[0], pointX);
      bounds[1] = Math.min(bounds[1], pointY);
      bounds[2] = Math.max(bounds[2], pointX);
      bounds[3] = Math.max(bounds[3], pointY);
    }

    return count;
  }

  // Andrew's monotone chain
  function buildHull() {
    order.sort((a, b) => projected[a * 2] - projected[b * 2] || projected[a * 2 + 1] - projected[b * 2 + 1]);
    hull.length = 0;

    order.forEach((point) => addHullPoint(MIN_TURN_POINTS, point));

    const lowerLength = hull.length + 1;
    for (let i = order.length - 2; i >= 0; i--) addHullPoint(lowerLength, order[i]);
    hull.pop();
  }

  function addHullPoint(minLength: number, point: number) {
    while (hull.length >= minLength && getTurn(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop();
    hull.push(point);
  }

  function getTurn(origin: number, a: number, b: number) {
    const x = projected[origin * 2];
    const y = projected[origin * 2 + 1];

    return (projected[a * 2] - x) * (projected[b * 2 + 1] - y) - (projected[a * 2 + 1] - y) * (projected[b * 2] - x);
  }

  return { createTarget, draw };
}

function buildOutline(vertices: Float32Array) {
  const keys = new Set<string>();
  const points: number[] = [];

  for (let i = 0; i < vertices.length; i += VERTEX_FLOATS) {
    const key = [0, 1, 2].map((axis) => Math.round(vertices[i + axis] * OUTLINE_GRID)).join();
    if (keys.has(key)) continue;

    keys.add(key);
    points.push(vertices[i], vertices[i + 1], vertices[i + 2]);
  }

  return new Float32Array(points);
}
