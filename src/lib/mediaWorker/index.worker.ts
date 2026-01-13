import '../rlottie/rlottie.worker';
import '../offscreen-canvas/offscreen-canvas.worker';

import type { OffscreenCanvasApi } from '../offscreen-canvas/offscreen-canvas.worker';
import type { RLottieApi } from '../rlottie/rlottie.worker';

export type MediaWorkerApi =
  RLottieApi
  & OffscreenCanvasApi;
