import '../tlottie/tlottie.worker';
import '../offscreen-canvas/offscreen-canvas.worker';

import type { OffscreenCanvasApi } from '../offscreen-canvas/offscreen-canvas.worker';
import type { TLottieApi } from '../tlottie/tlottie.worker';

export type MediaWorkerApi =
  TLottieApi
  & OffscreenCanvasApi;
