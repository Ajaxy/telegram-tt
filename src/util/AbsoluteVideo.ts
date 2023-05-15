import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import safePlay from './safePlay';

type AbsoluteVideoOptions = {
  position: { x: number; y: number };
  noLoop?: boolean;
  size: number;
  style?: string;
};

export default class AbsoluteVideo {
  private video?: HTMLVideoElement;

  private isPlaying = false;

  constructor(
    videoUrl: string,
    private container: HTMLElement,
    private options: AbsoluteVideoOptions,
  ) {
    this.video = document.createElement('video');
    this.video.src = videoUrl;
    this.video.disablePictureInPicture = true;
    this.video.muted = true;
    if (options.style) {
      this.video.setAttribute('style', options.style);
    }
    this.video.style.position = 'absolute';
    this.video.load();

    if (!this.options.noLoop) {
      this.video.loop = true;
    }

    requestMutation(() => {
      this.container.appendChild(this.video!);

      this.recalculatePositionAndSize();
    });
  }

  public play() {
    if (this.isPlaying || !this.video) return;
    this.recalculatePositionAndSize();
    if (this.video.paused) {
      safePlay(this.video);
    }
    this.isPlaying = true;
  }

  public pause() {
    if (!this.isPlaying || !this.video) return;
    if (!this.video.paused) {
      this.video.pause();
    }
    this.isPlaying = false;
  }

  public destroy() {
    this.pause();
    this.video?.remove();
    this.video = undefined;
  }

  public updatePosition(position: AbsoluteVideoOptions['position']) {
    this.options.position = position;
    this.recalculatePositionAndSize();
  }

  private recalculatePositionAndSize() {
    const { size, position: { x, y } } = this.options;
    requestMeasure(() => {
      if (!this.video) return;
      const video = this.video;
      const { width, height } = this.container.getBoundingClientRect();
      requestMutation(() => {
        video.style.left = `${Math.round(x * width)}px`;
        video.style.top = `${Math.round(y * height)}px`;
        video.style.width = `${size}px`;
        video.style.height = `${size}px`;
      });
    });
  }
}
