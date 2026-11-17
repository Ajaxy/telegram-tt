import type { GpuDeviceHold } from '../../../../lib/gpu/device';
import type { StickerTexture } from './stickerTexture';

import { acquireGpuDevice, getIsGpuAvailable } from '../../../../lib/gpu/device';
import { areRecordsShallowEqual } from '../../../../util/areShallowEqual';
import curlShader from '../shaders/stickerCurl.wgsl?raw';

type StickerCanvasEffect = {
  // The side of the texture in CSS pixels
  side: number;
  front: number;
  bend: number;
  shade: number;
  border: number;
};

export type StickerCanvas = {
  draw: (effect: StickerCanvasEffect) => void;
  destroy: NoneToVoidFunction;
};

type CurlRenderer = GpuDeviceHold & {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
};

// The device pixels of the canvas, which stays the same while the sticker grows and shrinks through its transform
export const STICKER_CANVAS_SIZE = 512;
// As in the iOS app, the layer leaves 30% of the sticker side on every edge for the curl and the shadow
export const STICKER_LAYER_SCALE = 1.6;
const LAYER_PADDING = 0.3;
const UNIFORM_FLOATS = 8;

let curlRenderer: CurlRenderer | undefined;
let curlRendererPromise: Promise<CurlRenderer | undefined> | undefined;
let holdCount = 0;
// Grows each time the renderer is dropped, so a compilation started before keeps nothing
let curlGeneration = 0;

// Keeps the device and the pipeline while the editor is open, so the first peel can curl
export function holdStickerCurl() {
  holdCount++;
  prepareStickerCurl();

  let isReleased = false;

  return () => {
    if (isReleased) return;

    isReleased = true;
    holdCount--;
    if (!holdCount) dropCurlRenderer();
  };
}

// Starts the curl again after the device was lost
export function prepareStickerCurl() {
  if (!holdCount || !getIsGpuAvailable()) return;

  if (curlRendererPromise) return;

  const promise: Promise<CurlRenderer | undefined> = createCurlRenderer().catch(() => undefined).then((renderer) => {
    if (!renderer && curlRendererPromise === promise) curlRendererPromise = undefined;
    return renderer;
  });
  curlRendererPromise = promise;
}

async function createCurlRenderer(): Promise<CurlRenderer | undefined> {
  const generation = curlGeneration;
  const gpu = await acquireGpuDevice();
  if (!gpu) return undefined;

  const { device, format } = gpu;
  let renderer: CurlRenderer;
  try {
    const module = device.createShaderModule({ code: curlShader });
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });
    const pipeline = await device.createRenderPipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: 'stickerVertex' },
      fragment: { module, entryPoint: 'stickerFragment', targets: [{ format }] },
      primitive: { topology: 'triangle-strip' },
    });
    renderer = {
      ...gpu,
      pipeline,
      bindGroupLayout,
      sampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
    };
  } catch {
    gpu.release();
    return undefined;
  }

  // The editor closed, or closed and opened again, while the pipeline started
  if (generation !== curlGeneration) {
    gpu.release();
    return undefined;
  }

  void device.lost.then(() => {
    if (curlRenderer === renderer) dropCurlRenderer();
  });

  curlRenderer = renderer;

  return renderer;
}

function dropCurlRenderer() {
  const renderer = curlRenderer;
  curlRenderer = undefined;
  curlRendererPromise = undefined;
  curlGeneration++;
  renderer?.release();
}

export function getIsStickerCurlReady() {
  return Boolean(curlRenderer);
}

// A lost device calls `onLost`: a canvas configured for the GPU cannot draw in 2D, so the owner renders a new one
export function createStickerCanvas(
  canvas: HTMLCanvasElement, texture: StickerTexture, isFlat?: boolean, onLost?: NoneToVoidFunction,
) {
  canvas.width = STICKER_CANVAS_SIZE;
  canvas.height = STICKER_CANVAS_SIZE;

  const curlCanvas = !isFlat && curlRenderer && createCurlCanvas(curlRenderer, canvas, texture, onLost);

  return curlCanvas || createFlatCanvas(canvas, texture);
}

function createCurlCanvas(
  {
    device, format, pipeline, bindGroupLayout, sampler,
  }: CurlRenderer,
  canvas: HTMLCanvasElement,
  texture: StickerTexture,
  onLost?: NoneToVoidFunction,
): StickerCanvas | undefined {
  const context = canvas.getContext('webgpu');
  if (!context) return undefined;

  context.configure({ device, format, alphaMode: 'premultiplied' });
  let isDestroyed = false;
  void device.lost.then(() => {
    if (!isDestroyed) onLost?.();
  });

  const image = uploadTexture(device, texture.image);
  const art = uploadTexture(device, texture.art);
  const data = new Float32Array(UNIFORM_FLOATS);
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer } },
      { binding: 1, resource: image.createView() },
      { binding: 2, resource: art.createView() },
      { binding: 3, resource: sampler },
    ],
  });

  let drawn: StickerCanvasEffect | undefined;

  return {
    draw(effect) {
      if (drawn && areRecordsShallowEqual(drawn, effect)) return;

      drawn = effect;
      const {
        side, front, bend, shade, border,
      } = effect;
      const inset = side * LAYER_PADDING;
      data.set([inset, inset, side, side * STICKER_LAYER_SCALE, front, bend, shade, border]);
      device.queue.writeBuffer(buffer, 0, data);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(4);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() {
      isDestroyed = true;
      image.destroy();
      art.destroy();
      buffer.destroy();
      context.unconfigure();
    },
  };
}

function uploadTexture(device: GPUDevice, source: HTMLCanvasElement) {
  const texture = device.createTexture({
    size: [source.width, source.height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source }, { texture, premultipliedAlpha: true }, [source.width, source.height],
  );

  return texture;
}

// Without the curl only the die-cut changes, so the canvas is drawn again only then
function createFlatCanvas(canvas: HTMLCanvasElement, { image, art }: StickerTexture): StickerCanvas {
  const context = canvas.getContext('2d')!;
  const inset = STICKER_CANVAS_SIZE * (LAYER_PADDING / STICKER_LAYER_SCALE);
  const side = STICKER_CANVAS_SIZE / STICKER_LAYER_SCALE;
  let drawnBorder: number | undefined;

  return {
    draw({ border }) {
      if (border === drawnBorder) return;

      drawnBorder = border;
      context.clearRect(0, 0, STICKER_CANVAS_SIZE, STICKER_CANVAS_SIZE);
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1 - border;
      context.drawImage(art, inset, inset, side, side);
      // Premultiplied colors add up to the mix of the two
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = border;
      context.drawImage(image, inset, inset, side, side);
    },
    destroy() {
      context.clearRect(0, 0, STICKER_CANVAS_SIZE, STICKER_CANVAS_SIZE);
    },
  };
}
