import { animate } from '../../util/animation';
import cycleRestrict from '../../util/cycleRestrict';
import Deferred from '../../util/Deferred';
import generateUniqueId from '../../util/generateUniqueId';
import launchMediaWorkers, { MAX_WORKERS } from '../../util/launchMediaWorkers';
import {
  IS_ANDROID, IS_IOS, IS_SAFARI,
} from '../../util/windowEnvironment';
import { requestMeasure, requestMutation } from '../fasterdom/fasterdom';

interface Params {
  size: number;
  noLoop?: boolean;
  quality?: number;
  isLowPriority?: boolean;
  coords?: { x: number; y: number };
}

const WAITING = Symbol('WAITING');
type Frame =
  undefined
  | typeof WAITING
  | ImageBitmap;

const HIGH_PRIORITY_QUALITY = (IS_ANDROID || IS_IOS) ? 0.75 : 1;
const LOW_PRIORITY_QUALITY = IS_ANDROID ? 0.5 : 0.75;
const LOW_PRIORITY_QUALITY_SIZE_THRESHOLD = 24;
const HIGH_PRIORITY_CACHE_MODULO = IS_SAFARI ? 2 : 4;
const LOW_PRIORITY_CACHE_MODULO = 0;

const workers = launchMediaWorkers().map(({ connector }) => connector);
const instancesByRenderId = new Map<string, RLottie>();

const PENDING_CANVAS_RESIZES = new WeakMap<HTMLCanvasElement, Promise<void>>();

let lastWorkerIndex = -1;

class RLottie {
  // Config

  private views = new Map<string, {
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
    const [
      , canvas,
      renderId,
      params,
      viewId = generateUniqueId(), ,
      onLoad,
    ] = args;
    let instance = instancesByRenderId.get(renderId);

    if (!instance) {
      // eslint-disable-next-line prefer-rest-params
      instance = new RLottie(...args);
      instancesByRenderId.set(renderId, instance);
    } else {
      instance.addView(viewId, canvas, onLoad, params?.coords);
    }

    return instance;
  }

  constructor(
    private tgsUrl: string,
    private container: HTMLDivElement | HTMLCanvasElement,
    private renderId: string,
    private params: Params,
    viewId: string = generateUniqueId(),
    private customColor?: [number, number, number],
    private onLoad?: NoneToVoidFunction | undefined,
    private onEnded?: (isDestroyed?: boolean) => void,
    private onLoop?: () => void,
  ) {
    this.addView(viewId, container, onLoad, params.coords);
    this.initConfig();
    this.initRenderer();
  }

  public removeView(viewId: string) {
    const {
      canvas, ctx, isSharedCanvas, coords,
    } = this.views.get(viewId)!;

    if (isSharedCanvas) {
      ctx.clearRect(coords!.x, coords!.y, this.imgSize, this.imgSize);
    } else {
      canvas.remove();
    }

    this.views.delete(viewId);

    if (!this.views.size) {
      this.destroy();
    }
  }

  isPlaying() {
    return this.isAnimating || this.isWaiting;
  }

  play(forceRestart = false, viewId?: string) {
    if (viewId) {
      this.views.get(viewId)!.isPaused = false;
    }

    if (this.isEnded && forceRestart) {
      this.approxFrameIndex = Math.floor(0);
    }

    this.stopFrameIndex = undefined;
    this.direction = 1;
    this.doPlay();
  }

  pause(viewId?: string) {
    this.lastRenderAt = undefined;

    if (viewId) {
      this.views.get(viewId)!.isPaused = true;

      const areAllContainersPaused = Array.from(this.views.values()).every(({ isPaused }) => isPaused);
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

  playSegment([startFrameIndex, stopFrameIndex]: [number, number], forceRestart = false, viewId?: string) {
    if (viewId) {
      this.views.get(viewId)!.isPaused = false;
    }

    const frameIndex = Math.round(this.approxFrameIndex);
    this.stopFrameIndex = Math.floor(stopFrameIndex / this.reduceFactor);
    if (frameIndex !== stopFrameIndex || forceRestart) {
      this.approxFrameIndex = Math.floor(startFrameIndex / this.reduceFactor);
    }
    this.direction = startFrameIndex < stopFrameIndex ? 1 : -1;

    this.doPlay();
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  setNoLoop(noLoop?: boolean) {
    this.params.noLoop = noLoop;
  }

  async setSharedCanvasCoords(viewId: string, newCoords: Params['coords']) {
    const containerInfo = this.views.get(viewId)!;
    const {
      canvas, ctx,
    } = containerInfo;

    const isCanvasDirty = !canvas.dataset.isJustCleaned || canvas.dataset.isJustCleaned === 'false';

    if (!isCanvasDirty) {
      await PENDING_CANVAS_RESIZES.get(canvas);
    }

    let [canvasWidth, canvasHeight] = [canvas.width, canvas.height];

    if (isCanvasDirty) {
      const sizeFactor = this.calcSizeFactor();
      ([canvasWidth, canvasHeight] = ensureCanvasSize(canvas, sizeFactor));
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      canvas.dataset.isJustCleaned = 'true';
      requestMeasure(() => {
        canvas.dataset.isJustCleaned = 'false';
      });
    }

    containerInfo.coords = {
      x: Math.round((newCoords?.x || 0) * canvasWidth),
      y: Math.round((newCoords?.y || 0) * canvasHeight),
    };

    const frame = this.getFrame(this.prevFrameIndex) || this.getFrame(Math.round(this.approxFrameIndex));

    if (frame && frame !== WAITING) {
      ctx.drawImage(frame, containerInfo.coords!.x, containerInfo.coords!.y);
    }
  }

  private addView(
    viewId: string,
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

      const { size } = this.params;

      imgSize = Math.round(size * sizeFactor);

      if (!this.imgSize) {
        this.imgSize = imgSize;
        this.imageData = new ImageData(imgSize, imgSize);
      }

      requestMutation(() => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;

        canvas.width = imgSize;
        canvas.height = imgSize;

        container.appendChild(canvas);

        this.views.set(viewId, {
          canvas, ctx, onLoad,
        });
      });
    } else {
      if (!container.isConnected) {
        throw new Error('[RLottie] Shared canvas is not mounted');
      }

      const canvas = container;
      const ctx = canvas.getContext('2d')!;

      imgSize = Math.round(this.params.size * sizeFactor);

      if (!this.imgSize) {
        this.imgSize = imgSize;
        this.imageData = new ImageData(imgSize, imgSize);
      }

      const [canvasWidth, canvasHeight] = ensureCanvasSize(canvas, sizeFactor);

      this.views.set(viewId, {
        canvas,
        ctx,
        isSharedCanvas: true,
        coords: {
          x: Math.round(coords!.x * canvasWidth),
          y: Math.round(coords!.y * canvasHeight),
        },
        onLoad,
      });
    }

    if (this.isRendererInited) {
      this.doPlay();
    }
  }

  private calcSizeFactor() {
    const {
      size,
      isLowPriority,
      // Reduced quality only looks acceptable on big enough images
      quality = isLowPriority && (!size || size > LOW_PRIORITY_QUALITY_SIZE_THRESHOLD)
        ? LOW_PRIORITY_QUALITY : HIGH_PRIORITY_QUALITY,
    } = this.params;

    // Reduced quality only looks acceptable on high DPR screens
    return Math.max(window.devicePixelRatio * quality, 1);
  }

  private destroy() {
    this.isDestroyed = true;
    this.pause();
    this.clearCache();
    this.destroyRenderer();

    instancesByRenderId.delete(this.renderId);
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
      name: 'rlottie:init',
      args: [
        this.renderId,
        this.tgsUrl,
        this.imgSize,
        this.params.isLowPriority || false,
        this.customColor,
        this.onRendererInit.bind(this),
      ],
    });
  }

  private destroyRenderer() {
    workers[this.workerIndex].request({
      name: 'rlottie:destroy',
      args: [this.renderId],
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
      name: 'rlottie:changeData',
      args: [
        this.renderId,
        this.tgsUrl,
        this.params.isLowPriority || false,
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
        const areAllLoaded = Array.from(this.views.values()).every(({ isLoaded }) => isLoaded);
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
        this.views.forEach((containerData) => {
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
      const delta = (this.direction * this.speed) / currentSpeed;
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
    }, requestMutation);
  }

  private getFrame(frameIndex: number) {
    return this.frames[frameIndex];
  }

  private requestFrame(frameIndex: number) {
    this.frames[frameIndex] = WAITING;

    workers[this.workerIndex].request({
      name: 'rlottie:renderFrames',
      args: [this.renderId, frameIndex, this.onFrameLoad.bind(this)],
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
    const deferred = new Deferred<void>();
    PENDING_CANVAS_RESIZES.set(canvas, deferred.promise);
    requestMutation(() => {
      canvas.width = expectedWidth;
      canvas.height = expectedHeight;
      deferred.resolve();
    });
  }

  return [expectedWidth, expectedHeight];
}

export default RLottie;
