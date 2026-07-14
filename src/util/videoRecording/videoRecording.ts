import type { ActiveVideoRecording, Result, VideoRecorderEngine } from './types';

import { ROUND_VIDEO_RECORDING_SIZE } from '../../config';
import { recordWithMediaRecorder } from './mediaRecorderEngine';

export type { ActiveVideoRecording, Result } from './types';

const FPS = 30;
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'user',
  width: { ideal: 720 },
  height: { ideal: 720 },
  frameRate: { ideal: FPS },
};

const SAMPLE_SIZE = 16;
const MIN_VISIBLE_LUMINANCE = 10;
const MIN_FRAME_CHANGE = 1;
const VISIBLE_FRAME_TIMEOUT_MS = 1500;
const CANVAS_RADIUS = ROUND_VIDEO_RECORDING_SIZE / 2;
const CIRCLE_RADIUS = CANVAS_RADIUS + 1;
const BACKGROUND_BLUR_PX = 14;
const BACKGROUND_OVERSCAN = 24;
const BACKGROUND_DIM_ALPHA = 0.1;

const WATERMARK_TEXT = 'TELEGRAM';
const WATERMARK_ALPHA = 0.9;
const WATERMARK_FONT_PX = 12;
const WATERMARK_LETTER_SPACING = 4;
const WATERMARK_TEXT_ARC_RADIUS = CANVAS_RADIUS + 20;
const WATERMARK_TEXT_CENTER_ANGLE = (45 * Math.PI) / 180;
// eslint-disable-next-line @stylistic/max-len
const WATERMARK_PLANE_PATH = 'M4.219 14.363s10.066-4.358 13.425-5.746c6.393-2.643 7.72-3.102 8.586-3.117.19-.003.616.044.892.266.233.188.297.442.327.62s.07.583.039.9c-.347 3.617-1.846 12.395-2.608 16.447-.323 1.714-.958 2.289-1.573 2.345-1.337.122-2.352-.878-3.647-1.721-2.026-1.32-3.17-2.142-5.138-3.43-2.272-1.488-.799-2.306.496-3.643.34-.35 6.23-5.674 6.343-6.157.015-.06.028-.285-.107-.404-.134-.119-.333-.078-.476-.046-.305.069-9.71 6.378-9.71 6.378s-1.379.94-2.497.916c-.822-.017-2.403-.462-3.578-.841-1.442-.466-2.588-.712-2.488-1.503.078-.618 1.713-1.264 1.713-1.264';
const WATERMARK_PLANE_VIEWBOX = 32;
const WATERMARK_PLANE_SIZE = 28;
const WATERMARK_PLANE_CENTER_X = ROUND_VIDEO_RECORDING_SIZE * 0.1;
const WATERMARK_PLANE_CENTER_Y = ROUND_VIDEO_RECORDING_SIZE * 0.9;

export async function start(onTick: (elapsedMs: number) => void): Promise<ActiveVideoRecording> {
  const previewStream = await navigator.mediaDevices.getUserMedia({
    video: VIDEO_CONSTRAINTS,
    audio: true,
  });

  let rafId: number | undefined;
  let isStopped = false;
  let startedAt = 0;

  const videoEl = document.createElement('video');
  videoEl.srcObject = previewStream;
  videoEl.muted = true;
  videoEl.playsInline = true;

  const canvas = document.createElement('canvas');
  canvas.width = ROUND_VIDEO_RECORDING_SIZE;
  canvas.height = ROUND_VIDEO_RECORDING_SIZE;
  const ctx = canvas.getContext('2d')!;
  const canvasStream = canvas.captureStream(FPS);

  const watermarkCanvas = await createWatermarkCanvas();

  const release = () => {
    isStopped = true;
    if (rafId !== undefined) cancelAnimationFrame(rafId);
    previewStream.getTracks().forEach((track) => track.stop());
    canvasStream.getTracks().forEach((track) => track.stop());
    videoEl.pause();
    // eslint-disable-next-line no-null/no-null
    videoEl.srcObject = null;
  };

  try {
    await videoEl.play();
    await waitForVisibleFrame(videoEl);
  } catch (err) {
    release();
    throw err;
  }

  let lastTickSecond = -1;
  const drawFrame = () => {
    if (isStopped) return;

    const sourceWidth = videoEl.videoWidth;
    const sourceHeight = videoEl.videoHeight;
    if (sourceWidth && sourceHeight) {
      const side = Math.min(sourceWidth, sourceHeight);
      const offsetX = (sourceWidth - side) / 2;
      const offsetY = (sourceHeight - side) / 2;

      ctx.clearRect(0, 0, ROUND_VIDEO_RECORDING_SIZE, ROUND_VIDEO_RECORDING_SIZE);
      ctx.filter = `blur(${BACKGROUND_BLUR_PX}px)`;
      ctx.drawImage(
        videoEl, offsetX, offsetY, side, side,
        -BACKGROUND_OVERSCAN, -BACKGROUND_OVERSCAN,
        ROUND_VIDEO_RECORDING_SIZE + 2 * BACKGROUND_OVERSCAN,
        ROUND_VIDEO_RECORDING_SIZE + 2 * BACKGROUND_OVERSCAN,
      );
      ctx.filter = 'none';

      ctx.fillStyle = `rgba(0, 0, 0, ${BACKGROUND_DIM_ALPHA})`;
      ctx.fillRect(0, 0, ROUND_VIDEO_RECORDING_SIZE, ROUND_VIDEO_RECORDING_SIZE);
      ctx.drawImage(watermarkCanvas, 0, 0);

      ctx.save();
      ctx.beginPath();
      ctx.arc(CANVAS_RADIUS, CANVAS_RADIUS, CIRCLE_RADIUS, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        videoEl, offsetX, offsetY, side, side, 0, 0, ROUND_VIDEO_RECORDING_SIZE, ROUND_VIDEO_RECORDING_SIZE,
      );
      ctx.restore();
    }

    if (startedAt) {
      const elapsedMs = Date.now() - startedAt;
      const second = Math.floor(elapsedMs / 1000);
      if (second !== lastTickSecond) {
        lastTickSecond = second;
        onTick(elapsedMs);
      }
    }
    rafId = requestAnimationFrame(drawFrame);
  };
  drawFrame();

  const canvasVideoTrack = canvasStream.getVideoTracks()[0];
  const audioTrack = previewStream.getAudioTracks()[0];

  let engine: VideoRecorderEngine;
  try {
    engine = recordWithMediaRecorder(canvasVideoTrack, audioTrack);
  } catch (err) {
    release();
    throw err;
  }

  startedAt = Date.now();

  let stopPromise: Promise<Result> | undefined;

  return {
    previewStream,
    stop: () => {
      if (stopPromise) {
        return stopPromise;
      }

      stopPromise = (async () => {
        const durationMs = Date.now() - startedAt;
        isStopped = true;
        if (rafId !== undefined) cancelAnimationFrame(rafId);
        try {
          const blob = await engine.finalize();
          return {
            blob,
            duration: Math.round(durationMs / 1000),
            durationMs,
            width: ROUND_VIDEO_RECORDING_SIZE,
            height: ROUND_VIDEO_RECORDING_SIZE,
          };
        } finally {
          release();
        }
      })();

      return stopPromise;
    },
    cancel: () => {
      if (isStopped || stopPromise) return;
      isStopped = true;
      engine.cancel();
      release();
    },
  };
}

async function createWatermarkCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = ROUND_VIDEO_RECORDING_SIZE;
  canvas.height = ROUND_VIDEO_RECORDING_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = `rgba(255, 255, 255, ${WATERMARK_ALPHA})`;
  const planeScale = WATERMARK_PLANE_SIZE / WATERMARK_PLANE_VIEWBOX;
  ctx.save();
  ctx.translate(WATERMARK_PLANE_CENTER_X, WATERMARK_PLANE_CENTER_Y);
  ctx.scale(planeScale, planeScale);
  ctx.translate(-WATERMARK_PLANE_VIEWBOX / 2, -WATERMARK_PLANE_VIEWBOX / 2);
  ctx.fill(new Path2D(WATERMARK_PLANE_PATH));
  ctx.restore();

  const arcRadius = WATERMARK_TEXT_ARC_RADIUS;
  const startOffset = arcRadius * (Math.PI - WATERMARK_TEXT_CENTER_ANGLE);
  const arcPath = `M ${CANVAS_RADIUS - arcRadius} ${CANVAS_RADIUS}`
    + ` A ${arcRadius} ${arcRadius} 0 0 0 ${CANVAS_RADIUS + arcRadius} ${CANVAS_RADIUS}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"`
    + ` width="${ROUND_VIDEO_RECORDING_SIZE}" height="${ROUND_VIDEO_RECORDING_SIZE}">`
    + `<path id="arc" fill="none" d="${arcPath}"/>`
    + `<text fill="rgba(255,255,255,${WATERMARK_ALPHA})" font-family="Roboto, Arial, sans-serif"`
    + ` font-size="${WATERMARK_FONT_PX}" font-weight="600" letter-spacing="${WATERMARK_LETTER_SPACING}"`
    + ` text-anchor="middle"><textPath href="#arc" startOffset="${startOffset}">${WATERMARK_TEXT}</textPath>`
    + '</text></svg>';

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to rasterize watermark text'));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    ctx.drawImage(img, 0, 0);
  } catch {
    // No curved text if the SVG fails to rasterize — the plane glyph alone is enough
  }

  return canvas;
}

async function waitForVisibleFrame(videoEl: HTMLVideoElement) {
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = SAMPLE_SIZE;
  sampleCanvas.height = SAMPLE_SIZE;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx) return;

  const deadline = Date.now() + VISIBLE_FRAME_TIMEOUT_MS;
  const sampledValuesCount = SAMPLE_SIZE * SAMPLE_SIZE * 3;
  let previousData: Uint8ClampedArray | undefined;

  await new Promise<void>((resolve) => {
    const check = () => {
      if (Date.now() >= deadline) {
        resolve();
        return;
      }

      if (videoEl.videoWidth) {
        sampleCtx.drawImage(videoEl, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = sampleCtx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        let sum = 0;
        let changeSum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += data[i] + data[i + 1] + data[i + 2];
          if (previousData) {
            changeSum += Math.abs(data[i] - previousData[i])
              + Math.abs(data[i + 1] - previousData[i + 1])
              + Math.abs(data[i + 2] - previousData[i + 2]);
          }
        }

        const isBrightEnough = sum / sampledValuesCount > MIN_VISIBLE_LUMINANCE;
        const hasChanged = previousData && changeSum / sampledValuesCount > MIN_FRAME_CHANGE;
        if (isBrightEnough || hasChanged) {
          resolve();
          return;
        }

        previousData = data;
      }

      requestAnimationFrame(check);
    };
    check();
  });
}
