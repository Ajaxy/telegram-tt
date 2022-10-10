import { DEBUG } from '../config';

const safePlay = (mediaEl: HTMLMediaElement) => {
  mediaEl.play().catch((err) => {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn(err, mediaEl);
    }
  });
};

export const getIsVideoPlaying = (video: HTMLVideoElement) => {
  return video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2;
};

export default safePlay;
