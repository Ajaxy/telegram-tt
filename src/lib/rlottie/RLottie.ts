import {
  DPR,
  IS_SINGLE_COLUMN_LAYOUT,
  IS_SAFARI,
} from '../../util/environment';
import WorkerConnector from '../../util/WorkerConnector';
import { animate } from '../../util/animation';
import cycleRestrict from '../../util/cycleRestrict';

interface Params {
  noLoop?: boolean;
  size?: number;
  quality?: number;
  isLowPriority?: boolean;
}

type Frames = ArrayBuffer[];
type Chunks = (Frames | undefined)[];

// TODO Consider removing chunks
const CHUNK_SIZE = 1;
const MAX_WORKERS = 4;
const HIGH_PRIORITY_QUALITY = IS_SINGLE_COLUMN_LAYOUT ? 0.75 : 1;
const LOW_PRIORITY_QUALITY = 0.75;
const HIGH_PRIORITY_CACHE_MODULO = IS_SAFARI ? 2 : 4;
const LOW_PRIORITY_CACHE_MODULO = 0;

const workers = new Array(MAX_WORKERS).fill(undefined).map(
  () => new WorkerConnector(new Worker(new URL('./rlottie.worker.ts', import.meta.url))),
);
let lastWorkerIndex = -1;

class RLottie {
  // Config

  private imgSize!: number;

  private key!: string;

  private msPerFrame = 1000 / 60;

  private reduceFactor = 1;

  private cacheModulo!: number;

  private chunkSize!: number;

  private workerIndex!: number;

  private chunks: Chunks = [];

  private framesCount?: number;

  private chunksCount?: number;

  // Container

  private canvas = document.createElement('canvas');

  private ctx = this.canvas.getContext('2d')!;

  // State

  private isAnimating = false;

  private isWaiting = true;

  private isOnLoadFired = false;

  private isDestroyed = false;

  private approxFrameIndex = 0;

  private prevFrameIndex = -1;

  private stopFrameIndex? = 0;

  private speed = 1;

  private direction: 1 | -1 = 1;

  private lastRenderAt?: number;

  constructor(
    private id: string,
    private container: HTMLDivElement,
    private animationData: string,
    private params: Params = {},
    private onLoad?: () => void,
    private customColor?: [number, number, number],
    private onEnded?: (isDestroyed?: boolean) => void,
  ) {
    this.initContainer();
    this.initConfig();
    this.initRenderer();
  }

  isPlaying() {
    return this.isAnimating || this.isWaiting;
  }

  play() {
    this.stopFrameIndex = undefined;
    this.direction = 1;
    this.doPlay();
  }

  pause() {
    if (this.isWaiting) {
      this.stopFrameIndex = this.approxFrameIndex;
    } else {
      this.isAnimating = false;
    }

    const currentChunkIndex = this.getChunkIndex(this.approxFrameIndex);
    this.chunks = this.chunks.map((chunk, i) => (i === currentChunkIndex ? chunk : undefined));
  }

  goToAndPlay(frameIndex: number) {
    this.approxFrameIndex = Math.floor(frameIndex / this.reduceFactor);
    this.stopFrameIndex = undefined;
    this.direction = 1;
    this.doPlay();
  }

  goToAndStop(frameIndex: number) {
    this.approxFrameIndex = Math.floor(frameIndex / this.reduceFactor);
    this.stopFrameIndex = Math.floor(frameIndex / this.reduceFactor);
    this.direction = 1;
    this.doPlay();
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

  destroy() {
    this.isDestroyed = true;
    this.pause();
    this.destroyRenderer();
    this.destroyContainer();
  }

  private initContainer() {
    if (!(this.container.parentNode instanceof HTMLElement)) {
      throw new Error('[RLottie] Container is not mounted');
    }

    let { size } = this.params;

    if (!size) {
      size = (
        this.container.offsetWidth
        || parseInt(this.container.style.width, 10)
        || this.container.parentNode.offsetWidth
      );

      if (!size) {
        throw new Error('[RLottie] Failed to detect width from container');
      }
    }

    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    const { isLowPriority, quality = isLowPriority ? LOW_PRIORITY_QUALITY : HIGH_PRIORITY_QUALITY } = this.params;
    // Reduced quality only looks acceptable on high DPR screens
    const imgSize = Math.round(size * Math.max(DPR * quality, 1));

    this.canvas.width = imgSize;
    this.canvas.height = imgSize;

    this.container.appendChild(this.canvas);

    this.imgSize = imgSize;
  }

  private initConfig() {
    this.key = `${this.id}_${this.imgSize}`;

    const { isLowPriority } = this.params;

    this.cacheModulo = isLowPriority ? LOW_PRIORITY_CACHE_MODULO : HIGH_PRIORITY_CACHE_MODULO;
    this.chunkSize = CHUNK_SIZE;
  }

  private destroyContainer() {
    this.canvas.remove();
  }

  setColor(newColor: [number, number, number] | undefined) {
    this.customColor = newColor;

    // TODO Remove?
    if (this.customColor) {
      const imageData = this.ctx.getImageData(0, 0, this.imgSize, this.imgSize);
      const arr = imageData.data;
      for (let i = 0; i < arr.length; i += 4) {
        /* eslint-disable prefer-destructuring */
        arr[i] = this.customColor[0];
        arr[i + 1] = this.customColor[1];
        arr[i + 2] = this.customColor[2];
        /* eslint-enable prefer-destructuring */
      }
      this.ctx.putImageData(imageData, 0, 0);
    }
  }

  private initRenderer() {
    this.workerIndex = cycleRestrict(MAX_WORKERS, ++lastWorkerIndex);

    workers[this.workerIndex].request({
      name: 'init',
      args: [
        this.key,
        this.animationData,
        this.imgSize,
        this.params.isLowPriority,
        this.onRendererInit.bind(this),
      ],
    });
  }

  private destroyRenderer() {
    workers[this.workerIndex].request({
      name: 'destroy',
      args: [this.key],
    });
  }

  private onRendererInit(reduceFactor: number, msPerFrame: number, framesCount: number) {
    this.reduceFactor = reduceFactor;
    this.msPerFrame = msPerFrame;
    this.framesCount = framesCount;
    this.chunksCount = Math.ceil(framesCount / this.chunkSize);

    if (this.isWaiting) {
      this.doPlay();
    }
  }

  changeData(animationData: string) {
    this.pause();
    this.animationData = animationData;
    this.initConfig();

    workers[this.workerIndex].request({
      name: 'changeData',
      args: [
        this.key,
        this.animationData,
        this.params.isLowPriority,
        this.onChangeData.bind(this),
      ],
    });
  }

  private onChangeData(reduceFactor: number, msPerFrame: number, framesCount: number) {
    this.reduceFactor = reduceFactor;
    this.msPerFrame = msPerFrame;
    this.framesCount = framesCount;
    this.chunksCount = Math.ceil(framesCount / this.chunkSize);
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

    this.isAnimating = true;
    this.isWaiting = false;

    animate(() => {
      if (this.isDestroyed) {
        return false;
      }

      // Paused from outside
      if (!this.isAnimating && this.isOnLoadFired) {
        return false;
      }

      const frameIndex = Math.round(this.approxFrameIndex);
      const chunkIndex = this.getChunkIndex(frameIndex);
      const chunk = this.chunks[chunkIndex];

      if (!chunk || chunk.length === 0) {
        this.requestChunk(chunkIndex);
        this.isAnimating = false;
        this.isWaiting = true;
        return false;
      }

      if (this.cacheModulo && chunkIndex % this.cacheModulo === 0) {
        this.cleanupPrevChunk(chunkIndex);
      }

      this.requestNextChunk(chunkIndex);

      if (frameIndex !== this.prevFrameIndex) {
        const frame = this.getFrame(frameIndex);
        if (!frame) {
          this.isAnimating = false;
          this.isWaiting = true;
          return false;
        }

        const arr = new Uint8ClampedArray(frame);
        if (this.customColor) {
          for (let i = 0; i < arr.length; i += 4) {
            /* eslint-disable prefer-destructuring */
            arr[i] = this.customColor[0];
            arr[i + 1] = this.customColor[1];
            arr[i + 2] = this.customColor[2];
            /* eslint-enable prefer-destructuring */
          }
        }
        const imageData = new ImageData(arr, this.imgSize, this.imgSize);
        this.ctx.putImageData(imageData, 0, 0);

        if (this.onLoad && !this.isOnLoadFired) {
          this.isOnLoadFired = true;
          this.onLoad();
        }

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
          this.onEnded?.();
          return false;
        }

        this.approxFrameIndex = 0;

        // Backward animation finished
      } else if (delta < 0 && (frameIndex === 0 || expectedNextFrameIndex < 0)) {
        if (this.params.noLoop) {
          this.isAnimating = false;
          this.onEnded?.();
          return false;
        }

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
        this.requestChunk(this.getChunkIndex(nextFrameIndex));
        this.isWaiting = true;
        this.isAnimating = false;
        return false;
      }

      return true;
    });
  }

  private getFrame(frameIndex: number) {
    const chunkIndex = this.getChunkIndex(frameIndex);
    const indexInChunk = this.getFrameIndexInChunk(frameIndex);
    const chunk = this.chunks[chunkIndex];
    if (!chunk) {
      return undefined;
    }

    return chunk[indexInChunk];
  }

  private getFrameIndexInChunk(frameIndex: number) {
    const chunkIndex = this.getChunkIndex(frameIndex);
    return frameIndex - chunkIndex * this.chunkSize;
  }

  private getChunkIndex(frameIndex: number) {
    return Math.floor(frameIndex / this.chunkSize);
  }

  private requestChunk(chunkIndex: number) {
    if (this.chunks[chunkIndex] && this.chunks[chunkIndex]?.length !== 0) {
      return;
    }

    this.chunks[chunkIndex] = [];

    const fromIndex = chunkIndex * this.chunkSize;
    const toIndex = Math.min(fromIndex + this.chunkSize - 1, this.framesCount! - 1);

    workers[this.workerIndex].request({
      name: 'renderFrames',
      args: [this.key, fromIndex, toIndex, this.onFrameLoad.bind(this)],
    });
  }

  private cleanupPrevChunk(chunkIndex: number) {
    if (this.chunksCount! < 3) {
      return;
    }

    const prevChunkIndex = cycleRestrict(this.chunksCount!, chunkIndex - 1);
    this.chunks[prevChunkIndex] = undefined;
  }

  private requestNextChunk(chunkIndex: number) {
    if (this.chunksCount === 1) {
      return;
    }

    const nextChunkIndex = cycleRestrict(this.chunksCount!, chunkIndex + 1);

    if (!this.chunks[nextChunkIndex]) {
      this.requestChunk(nextChunkIndex);
    }
  }

  private onFrameLoad(frameIndex: number, arrayBuffer: ArrayBuffer) {
    const chunkIndex = this.getChunkIndex(frameIndex);
    const chunk = this.chunks[chunkIndex];
    // Frame can be skipped and chunk can be already cleaned up
    if (!chunk) {
      return;
    }

    chunk[this.getFrameIndexInChunk(frameIndex)] = arrayBuffer;

    if (this.isWaiting) {
      this.doPlay();
    }
  }
}

export default RLottie;
