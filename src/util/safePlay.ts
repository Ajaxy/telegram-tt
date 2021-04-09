import { DEBUG } from '../config';

export default (mediaEl: HTMLMediaElement) => {
  mediaEl.play().catch((err) => {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn(err);
    }
  });
};
