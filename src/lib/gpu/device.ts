// One WebGPU device for the page. Every user holds it while it draws, and the last release destroys it.

type GpuDevice = {
  device: GPUDevice;
  format: GPUTextureFormat;
};

export type GpuDeviceHold = GpuDevice & {
  release: NoneToVoidFunction;
};

let devicePromise: Promise<GpuDevice | undefined> | undefined;
let current: GpuDevice | undefined;
let holdCount = 0;
// Set once WebGPU cannot start, so the users fall back at once and do not ask again
let isUnavailable = false;

export function getIsGpuAvailable() {
  return Boolean(navigator.gpu) && !isUnavailable;
}

// The hold counts from the call, so a release elsewhere while the device starts does not destroy it
export async function acquireGpuDevice(): Promise<GpuDeviceHold | undefined> {
  if (!getIsGpuAvailable()) return undefined;

  holdCount++;
  devicePromise ??= createDevice();
  const gpu = await devicePromise;
  if (!gpu) {
    holdCount--;
    return undefined;
  }

  let isReleased = false;

  return {
    ...gpu,
    release() {
      if (isReleased) return;

      isReleased = true;
      holdCount--;
      if (!holdCount) destroyDevice();
    },
  };
}

async function createDevice(): Promise<GpuDevice | undefined> {
  try {
    const adapter = await navigator.gpu.requestAdapter();
    // A software adapter is far too slow for the shaders of the page
    if (!adapter || adapter.info?.isFallbackAdapter) {
      isUnavailable = true;
      devicePromise = undefined;
      return undefined;
    }

    const device = await adapter.requestDevice();
    const gpu: GpuDevice = { device, format: navigator.gpu.getPreferredCanvasFormat() };

    void device.lost.then(() => {
      if (current !== gpu) return;

      current = undefined;
      devicePromise = undefined;
    });

    current = gpu;

    return gpu;
  } catch {
    isUnavailable = true;
    devicePromise = undefined;
    return undefined;
  }
}

function destroyDevice() {
  const gpu = current;
  current = undefined;
  devicePromise = undefined;
  gpu?.device.destroy();
}
