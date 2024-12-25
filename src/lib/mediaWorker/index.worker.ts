import '../rlottie/rlottie.worker';
import '../video-preview/video-preview.worker';
import '../offscreen-canvas/offscreen-canvas.worker';

import type { OffscreenCanvasApi } from '../offscreen-canvas/offscreen-canvas.worker';
import type { RLottieApi } from '../rlottie/rlottie.worker';
import type { VideoPreviewApi } from '../video-preview/video-preview.worker';

export type MediaWorkerApi =
  RLottieApi
  & VideoPreviewApi
  & OffscreenCanvasApi;
