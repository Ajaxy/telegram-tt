import {
  DPR,
  IS_SINGLE_COLUMN_LAYOUT,
  IS_SAFARI,
  IS_ANDROID,
} from '../../util/environment';
import WorkerConnector from '../../util/WorkerConnector';
import { animate } from '../../util/animation';
import cycleRestrict from '../../util/cycleRestrict';
import { fastRaf } from '../../util/schedulers';

interface Params {
  noLoop?: boolean;
  size?: number;
  quality?: number;
  isLowPriority?: boolean;
  coords?: { x: number; y: number };
}

const WAITING = Symbol('WAITING');
type Frame =
  undefined
  | typeof WAITING
  | ImageBitmap;

const MAX_WORKERS = 4;
const HIGH_PRIORITY_QUALITY = IS_SINGLE_COLUMN_LAYOUT ? 0.75 : 1;
const LOW_PRIORITY_QUALITY = IS_ANDROID ? 0.5 : 0.75;
const LOW_PRIORITY_QUALITY_SIZE_THRESHOLD = 24;
const HIGH_PRIORITY_CACHE_MODULO = IS_SAFARI ? 2 : 4;
const LOW_PRIORITY_CACHE_MODULO = 0;

const instancesById = new Map<string, RLottie>();

const workers = new Array(MAX_WORKERS).fill(undefined).map(
  () => new WorkerConnector(new Worker(new URL('./rlottie.worker.ts', import.meta.url))),
);
let lastWorkerIndex = -1;

class RLottie {
  // Config

  private containers = new Map<string, {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    isLoaded?: boolean;
    isPaused?: boolean;
    isSharedCanvas?: boolean;
    coords?: Params['coords'];
    onLoad?: NoneToVoidFunction;
  }>();

  private imgSize!: number;

  private imageData!: ImageData;

  private msPerFrame = 1000 / 60;

  private reduceFactor = 1;

  private cacheModulo!: number;

  private workerIndex!: number;

  private frames: Frame[] = [];

  private framesCount?: number;

  // State

  private isAnimating = false;

  private isWaiting = true;

  private isEnded = false;

  private isDestroyed = false;

  private isRendererInited = false;

  private approxFrameIndex = 0;

  private prevFrameIndex = -1;

  private stopFrameIndex? = 0;

  private speed = 1;

  private direction: 1 | -1 = 1;

  private lastRenderAt?: number;

  static init(...args: ConstructorParameters<typeof RLottie>) {
    const [container, canvas, onLoad, id, , params] = args;
    let instance = instancesById.get(id);

    if (!instance) {
      // eslint-disable-next-line prefer-rest-params
      instance = new RLottie(...args);
      instancesById.set(id, instance);
    } else {
      instance.addContainer(container, canvas, onLoad, params?.coords);
    }

    return instance;
  }

  constructor(
    containerId: string,
    container: HTMLDivElement | HTMLCanvasElement,
    onLoad: NoneToVoidFunction | undefined,
    private id: string,
    private tgsUrl: string,
    private params: Params = {},
    private customColor?: [number, number, number],
    private onEnded?: (isDestroyed?: boolean) => void,
    private onLoop?: () => void,
  ) {
    this.addContainer(containerId, container, onLoad, params.coords);
    this.initConfig();
    this.initRenderer();
  }

  public removeContainer(containerId: string) {
    const {
      canvas, ctx, isSharedCanvas, coords,
    } = this.containers.get(containerId)!;

    if (isSharedCanvas) {
      ctx.clearRect(coords!.x, coords!.y, this.imgSize, this.imgSize);
    } else {
      canvas.remove();
    }

    this.containers.delete(containerId);

    if (!this.containers.size) {
      this.destroy();
    }
  }

  isPlaying() {
    return this.isAnimating || this.isWaiting;
  }

  play(forceRestart = false, containerId?: string) {
    if (containerId) {
      this.containers.get(containerId)!.isPaused = false;
    }

    if (this.isEnded && forceRestart) {
      this.approxFrameIndex = Math.floor(0);
    }

    this.stopFrameIndex = undefined;
    this.direction = 1;
    this.doPlay();
  }

  pause(containerId?: string) {
    if (containerId) {
      this.containers.get(containerId)!.isPaused = true;

      const areAllContainersPaused = Array.from(this.containers.values()).every(({ isPaused }) => isPaused);
      if (!areAllContainersPaused) {
        return;
      }
    }

    if (this.isWaiting) {
      this.stopFrameIndex = this.approxFrameIndex;
    } else {
      this.isAnimating = false;
    }

    if (!this.params.isLowPriority) {
      this.frames = this.frames.map((frame, i) => {
        if (i === this.prevFrameIndex) {
          return frame;
        } else {
          if (frame && frame !== WAITING) {
            frame.close();
          }

          return undefined;
        }
      });
    }
  }

  playSegment([startFrameIndex, stopFrameIndex]: [number, number]) {
    this.approxFrameIndex = Math.floor(startFrameIndex / this.reduceFactor);
    this.stopFrameIndex = Math.floor(stopFrameIndex / this.reduceFactor);
    this.direction = startFrameIndex < stopFrameIndex ? 1 : -1;
    this.doPlay();
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  setNoLoop(noLoop?: boolean) {
    this.params.noLoop = noLoop;
  }

  setSharedCanvasCoords(containerId: string, newCoords: Params['coords']) {
    const containerInfo = this.containers.get(containerId)!;
    const {
      canvas, ctx,
    } = containerInfo;

    if (!canvas.dataset.isJustCleaned || canvas.dataset.isJustCleaned === 'false') {
      const sizeFactor = this.calcSizeFactor();
      ensureCanvasSize(canvas, sizeFactor);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.dataset.isJustCleaned = 'true';
      fastRaf(() => {
        canvas.dataset.isJustCleaned = 'false';
      });
    }

    containerInfo.coords = {
      x: Math.round((newCoords?.x || 0) * canvas.width),
      y: Math.round((newCoords?.y || 0) * canvas.height),
    };

    const frame = this.getFrame(this.prevFrameIndex) || this.getFrame(Math.round(this.approxFrameIndex));

    if (frame && frame !== WAITING) {
      ctx.drawImage(frame, containerInfo.coords.x, containerInfo.coords.y);
    }
  }

  private addContainer(
    containerId: string,
    container: HTMLDivElement | HTMLCanvasElement,
    onLoad?: NoneToVoidFunction,
    coords?: Params['coords'],
  ) {
    const sizeFactor = this.calcSizeFactor();

    let imgSize: number;

    if (container instanceof HTMLDivElement) {
      if (!(container.parentNode instanceof HTMLElement)) {
        throw new Error('[RLottie] Container is not mounted');
      }

      let { size } = this.params;

      if (!size) {
        size = (
          container.offsetWidth
          || parseInt(container.style.width, 10)
          || container.parentNode.offsetWidth
        );

        if (!size) {
          throw new Error('[RLottie] Failed to detect width from container');
        }
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      imgSize = Math.round(size * sizeFactor);

      canvas.width = imgSize;
      canvas.height = imgSize;

      container.appendChild(canvas);

      this.containers.set(containerId, {
        canvas, ctx, onLoad,
      });
    } else {
      if (!container.offsetParent) {
        throw new Error('[RLottie] Shared canvas is not mounted');
      }

      const canvas = container;
      const ctx = canvas.getContext('2d')!;

      ensureCanvasSize(canvas, sizeFactor);

      imgSize = Math.round(this.params.size! * sizeFactor);

      this.containers.set(containerId, {
        canvas,
        ctx,
        isSharedCanvas: true,
        coords: {
          x: Math.round((coords?.x || 0) * canvas.width),
          y: Math.round((coords?.y || 0) * canvas.height),
        },
        onLoad,
      });
    }

    if (!this.imgSize) {
      this.imgSize = imgSize;
      this.imageData = new ImageData(imgSize, imgSize);
    }

    if (this.isRendererInited) {
      this.doPlay();
    }
  }

  private calcSizeFactor() {
    const {
      isLowPriority,
      size,
      // Reduced quality only looks acceptable on big enough images
      quality = isLowPriority && (!size || size > LOW_PRIORITY_QUALITY_SIZE_THRESHOLD)
        ? LOW_PRIORITY_QUALITY
        : HIGH_PRIORITY_QUALITY,
    } = this.params;

    // Reduced quality only looks acceptable on high DPR screens
    return Math.max(DPR * quality, 1);
  }

  private destroy() {
    this.isDestroyed = true;
    this.pause();
    this.clearCache();
    this.destroyRenderer();

    instancesById.delete(this.id);
  }

  private clearCache() {
    this.frames.forEach((frame) => {
      if (frame && frame !== WAITING) {
        frame.close();
      }
    });

    // Help GC
    this.imageData = undefined as any;
    this.frames = [];
  }

  private initConfig() {
    const { isLowPriority } = this.params;

    this.cacheModulo = isLowPriority ? LOW_PRIORITY_CACHE_MODULO : HIGH_PRIORITY_CACHE_MODULO;
  }

  setColor(newColor: [number, number, number] | undefined) {
    this.customColor = newColor;
  }

  private initRenderer() {
    this.workerIndex = cycleRestrict(MAX_WORKERS, ++lastWorkerIndex);

    workers[this.workerIndex].request({
      name: 'init',
      args: [
        this.id,
        this.tgsUrl,
        this.imgSize,
        this.params.isLowPriority,
        this.customColor,
        this.onRendererInit.bind(this),
      ],
    });
  }

  private destroyRenderer() {
    workers[this.workerIndex].request({
      name: 'destroy',
      args: [this.id],
    });
  }

  private onRendererInit(reduceFactor: number, msPerFrame: number, framesCount: number) {
    this.isRendererInited = true;
    this.reduceFactor = reduceFactor;
    this.msPerFrame = msPerFrame;
    this.framesCount = framesCount;

    if (this.isWaiting) {
      this.doPlay();
    }
  }

  changeData(tgsUrl: string) {
    this.pause();
    this.tgsUrl = tgsUrl;
    this.initConfig();

    workers[this.workerIndex].request({
      name: 'changeData',
      args: [
        this.id,
        this.tgsUrl,
        this.params.isLowPriority,
        this.onChangeData.bind(this),
      ],
    });
  }

  private onChangeData(reduceFactor: number, msPerFrame: number, framesCount: number) {
    this.reduceFactor = reduceFactor;
    this.msPerFrame = msPerFrame;
    this.framesCount = framesCount;
    this.isWaiting = false;
    this.isAnimating = false;

    this.doPlay();
  }

  private doPlay() {
    if (!this.framesCount) {
      return;
    }

    if (this.isDestroyed) {
      return;
    }

    if (this.isAnimating) {
      return;
    }

    if (!this.isWaiting) {
      this.lastRenderAt = undefined;
    }

    this.isEnded = false;
    this.isAnimating = true;
    this.isWaiting = false;

    animate(() => {
      if (this.isDestroyed) {
        return false;
      }

      // Paused from outside
      if (!this.isAnimating) {
        const areAllLoaded = Array.from(this.containers.values()).every(({ isLoaded }) => isLoaded);
        if (areAllLoaded) {
          return false;
        }
      }

      const frameIndex = Math.round(this.approxFrameIndex);
      const frame = this.getFrame(frameIndex);
      if (!frame || frame === WAITING) {
        if (!frame) {
          this.requestFrame(frameIndex);
        }

        this.isAnimating = false;
        this.isWaiting = true;
        return false;
      }

      if (this.cacheModulo && frameIndex % this.cacheModulo === 0) {
        this.cleanupPrevFrame(frameIndex);
      }

      if (frameIndex !== this.prevFrameIndex) {
        this.containers.forEach((containerData) => {
          const {
            ctx, isLoaded, isPaused, coords: { x, y } = {}, onLoad,
          } = containerData;

          if (!isLoaded || !isPaused) {
            ctx.clearRect(x || 0, y || 0, this.imgSize, this.imgSize);
            ctx.drawImage(frame, x || 0, y || 0);
          }

          if (!isLoaded) {
            containerData.isLoaded = true;
            onLoad?.();
          }
        });

        this.prevFrameIndex = frameIndex;
      }

      const now = Date.now();
      const currentSpeed = this.lastRenderAt ? this.msPerFrame / (now - this.lastRenderAt) : 1;
      const delta = Math.min(1, (this.direction * this.speed) / currentSpeed);
      const expectedNextFrameIndex = Math.round(this.approxFrameIndex + delta);

      this.lastRenderAt = now;

      // Forward animation finished
      if (delta > 0 && (frameIndex === this.framesCount! - 1 || expectedNextFrameIndex > this.framesCount! - 1)) {
        if (this.params.noLoop) {
          this.isAnimating = false;
          this.isEnded = true;
          this.onEnded?.();
          return false;
        }
        this.onLoop?.();

        this.approxFrameIndex = 0;

        // Backward animation finished
      } else if (delta < 0 && (frameIndex === 0 || expectedNextFrameIndex < 0)) {
        if (this.params.noLoop) {
          this.isAnimating = false;
          this.isEnded = true;
          this.onEnded?.();
          return false;
        }
        this.onLoop?.();

        this.approxFrameIndex = this.framesCount! - 1;

        // Stop frame reached
      } else if (
        this.stopFrameIndex !== undefined
        && (frameIndex === this.stopFrameIndex
          || (
            (delta > 0 && expectedNextFrameIndex > this.stopFrameIndex)
            || (delta < 0 && expectedNextFrameIndex < this.stopFrameIndex)
          ))
      ) {
        this.stopFrameIndex = undefined;
        this.isAnimating = false;
        return false;

        // Preparing next frame
      } else {
        this.approxFrameIndex += delta;
      }

      const nextFrameIndex = Math.round(this.approxFrameIndex);

      if (!this.getFrame(nextFrameIndex)) {
        this.requestFrame(nextFrameIndex);
        this.isWaiting = true;
        this.isAnimating = false;
        return false;
      }

      return true;
    });
  }

  private getFrame(frameIndex: number) {
    return this.frames[frameIndex];
  }

  private requestFrame(frameIndex: number) {
    this.frames[frameIndex] = WAITING;

    workers[this.workerIndex].request({
      name: 'renderFrames',
      args: [this.id, frameIndex, this.onFrameLoad.bind(this)],
    });
  }

  private cleanupPrevFrame(frameIndex: number) {
    if (this.framesCount! < 3) {
      return;
    }

    const prevFrameIndex = cycleRestrict(this.framesCount!, frameIndex - 1);
    this.frames[prevFrameIndex] = undefined;
  }

  private onFrameLoad(frameIndex: number, imageBitmap: ImageBitmap) {
    if (this.frames[frameIndex] !== WAITING) {
      return;
    }

    this.frames[frameIndex] = imageBitmap;

    if (this.isWaiting) {
      this.doPlay();
    }
  }
}

function ensureCanvasSize(canvas: HTMLCanvasElement, sizeFactor: number) {
  const expectedWidth = Math.round(canvas.offsetWidth * sizeFactor);
  const expectedHeight = Math.round(canvas.offsetHeight * sizeFactor);
  if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
    canvas.width = expectedWidth;
    canvas.height = expectedHeight;
  }
}

export default RLottie;
