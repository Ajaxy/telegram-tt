import { DEBUG } from '../config';

const safePlay = (mediaEl: HTMLMediaElement) => {
  mediaEl.play().catch((err) => {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn(err, mediaEl);
    }
  });
};

export default safePlay;
