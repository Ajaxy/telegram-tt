import safePlay from './safePlay';

type AbsoluteVideoOptions = {
  position: { x: number; y: number };
  noLoop?: boolean;
  size: number;
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
    this.video.style.position = 'absolute';
    this.video.load();

    if (!this.options.noLoop) {
      this.video.loop = true;
    }

    this.container.appendChild(this.video);
    this.recalculatePositionAndSize();
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
    if (!this.video) return;
    const { size, position: { x, y } } = this.options;
    const { width, height } = this.container.getBoundingClientRect();
    this.video.style.left = `${Math.round(x * width)}px`;
    this.video.style.top = `${Math.round(y * height)}px`;
    this.video.style.width = `${size}px`;
    this.video.style.height = `${size}px`;
  }
}
