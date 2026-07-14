import type { ActiveVideoRecording, Result, VideoRecorderEngine } from './types';

import { ROUND_VIDEO_RECORDING_SIZE } from '../../config';
import { createTimekeeper } from '../voiceRecording';
import WaveformAnalyser from '../voiceRecording/waveformAnalyser';
import { createSnapshotRecorder, recordWithMediaRecorder } from './mediaRecorderEngine';

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
const EXPOSURE_SETTLE_MAX_DELTA = 1;
const EXPOSURE_SETTLE_FRAMES = 4;
const EXPOSURE_SETTLE_TIMEOUT_MS = 1500;
const VISIBLE_FRAME_TIMEOUT_MS = 1500;
const CANVAS_RADIUS = ROUND_VIDEO_RECORDING_SIZE / 2;
const CIRCLE_RADIUS = CANVAS_RADIUS + 1;
const BACKGROUND_BLUR_PX = 14;
const BACKGROUND_OVERSCAN = 24;
const BACKGROUND_DIM_ALPHA = 0.1;

const PEAK_TAP_BUFFER_SIZE = 2048;
const PLAYBACK_DURATION_TIMEOUT_MS = 2000;

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

export async function start(
  onTick: (elapsedMs: number) => void,
  onPeak: (peak: number) => void,
): Promise<ActiveVideoRecording> {
  const previewStream = await navigator.mediaDevices.getUserMedia({
    video: VIDEO_CONSTRAINTS,
    audio: true,
  });

  let rafId: number | undefined;
  let isStopped = false;
  let audioContext: AudioContext | undefined;
  let releaseAudioTap: NoneToVoidFunction | undefined;

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
    releaseAudioTap?.();
    void audioContext?.close().catch(() => undefined);
    previewStream.getTracks().forEach((track) => track.stop());
    canvasStream.getTracks().forEach((track) => track.stop());
    videoEl.pause();
    // eslint-disable-next-line no-null/no-null
    videoEl.srcObject = null;
  };

  const analyser = new WaveformAnalyser();
  analyser.onPeak = onPeak;

  let timekeeper: ReturnType<typeof createTimekeeper> | undefined;
  let engine: VideoRecorderEngine | undefined;
  let snapshot: ReturnType<typeof createSnapshotRecorder> | undefined;

  const setupPromise = (async () => {
    await videoEl.play();
    await waitForVisibleFrame(videoEl);
    if (isStopped) return;

    timekeeper = createTimekeeper();

    setupAudioTap();
    startDrawing();

    const canvasVideoTrack = canvasStream.getVideoTracks()[0];
    const audioTrack = previewStream.getAudioTracks()[0];
    engine = recordWithMediaRecorder(canvasVideoTrack, audioTrack);
    snapshot = createSnapshotRecorder(canvasVideoTrack, audioTrack);

    if (isStopped) {
      snapshot?.finish();
      engine.cancel();
    }
  })();
  setupPromise.catch(() => {
    release();
  });

  function setupAudioTap() {
    let tapTrack: MediaStreamTrack | undefined;
    try {
      const micTrack = previewStream.getAudioTracks()[0];
      tapTrack = micTrack?.clone();
      if (!tapTrack) return;

      audioContext = new AudioContext();
      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => undefined);
      }
      const tapSource = audioContext.createMediaStreamSource(new MediaStream([tapTrack]));
      const tap = audioContext.createScriptProcessor(PEAK_TAP_BUFFER_SIZE, 1, 1);
      tap.onaudioprocess = (e) => {
        if (isStopped || timekeeper?.getIsPaused()) return;
        analyser.pushSamples(e.inputBuffer.getChannelData(0));
      };
      tapSource.connect(tap);
      tap.connect(audioContext.destination);
      releaseAudioTap = () => {
        tap.onaudioprocess = undefined as unknown as typeof tap.onaudioprocess;
        try {
          tapSource.disconnect(tap);
        } catch (err) {
          // Already disconnected
        }
        tap.disconnect();
        tapTrack!.stop();
      };
    } catch (err) {
      tapTrack?.stop();
    }
  }

  let lastTickSecond = -1;
  function startDrawing() {
    drawFrame();
  }

  function drawFrame() {
    if (isStopped) return;

    const sourceWidth = videoEl.videoWidth;
    const sourceHeight = videoEl.videoHeight;
    if (sourceWidth && sourceHeight) {
      const side = Math.min(sourceWidth, sourceHeight);
      const offsetX = (sourceWidth - side) / 2;
      const offsetY = (sourceHeight - side) / 2;

      // The camera frames are recorded MIRRORED, exactly as the selfie preview shows them — so the recipient
      // sees the same picture the sender saw. The watermark is drawn outside the mirrored transform.
      ctx.clearRect(0, 0, ROUND_VIDEO_RECORDING_SIZE, ROUND_VIDEO_RECORDING_SIZE);
      ctx.save();
      ctx.translate(ROUND_VIDEO_RECORDING_SIZE, 0);
      ctx.scale(-1, 1);
      ctx.filter = `blur(${BACKGROUND_BLUR_PX}px)`;
      ctx.drawImage(
        videoEl, offsetX, offsetY, side, side,
        -BACKGROUND_OVERSCAN, -BACKGROUND_OVERSCAN,
        ROUND_VIDEO_RECORDING_SIZE + 2 * BACKGROUND_OVERSCAN,
        ROUND_VIDEO_RECORDING_SIZE + 2 * BACKGROUND_OVERSCAN,
      );
      ctx.filter = 'none';
      ctx.restore();

      ctx.fillStyle = `rgba(0, 0, 0, ${BACKGROUND_DIM_ALPHA})`;
      ctx.fillRect(0, 0, ROUND_VIDEO_RECORDING_SIZE, ROUND_VIDEO_RECORDING_SIZE);
      ctx.drawImage(watermarkCanvas, 0, 0);

      ctx.save();
      ctx.beginPath();
      ctx.arc(CANVAS_RADIUS, CANVAS_RADIUS, CIRCLE_RADIUS, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(ROUND_VIDEO_RECORDING_SIZE, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        videoEl, offsetX, offsetY, side, side, 0, 0, ROUND_VIDEO_RECORDING_SIZE, ROUND_VIDEO_RECORDING_SIZE,
      );
      ctx.restore();
    }

    const elapsedMs = timekeeper!.getElapsedMs();
    const second = Math.floor(elapsedMs / 1000);
    if (second !== lastTickSecond) {
      lastTickSecond = second;
      onTick(elapsedMs);
    }
    rafId = requestAnimationFrame(drawFrame);
  }

  let playbackVideo: HTMLVideoElement | undefined;
  let playbackUrl: string | undefined;
  let playbackPromise: Promise<HTMLVideoElement> | undefined;
  let playbackGeneration = 0;

  const destroyPlayback = () => {
    playbackGeneration++;
    playbackVideo?.pause();
    playbackVideo?.remove();
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    playbackVideo = undefined;
    playbackUrl = undefined;
    playbackPromise = undefined;
  };

  const createPlaybackVideo = async () => {
    const generation = playbackGeneration;
    const el = document.createElement('video');
    el.playsInline = true;
    const url = URL.createObjectURL(snapshot!.getBlob());
    el.src = url;
    try {
      await resolveMediaDuration(el);
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
    if (generation !== playbackGeneration) {
      URL.revokeObjectURL(url);
      throw new Error('Recording playback is stale');
    }
    playbackUrl = url;
    playbackVideo = el;
    return el;
  };

  const getPlaybackMedia = () => {
    if (!playbackPromise) {
      if (!snapshot) {
        return Promise.reject(new Error('Recording playback is unavailable'));
      }
      const promise = createPlaybackVideo();
      playbackPromise = promise;
      promise.catch(() => {
        if (playbackPromise === promise) {
          playbackPromise = undefined;
        }
      });
    }
    return playbackPromise;
  };

  let stopPromise: Promise<Result> | undefined;

  return {
    previewStream,
    stop: () => {
      if (stopPromise) {
        return stopPromise;
      }

      stopPromise = (async () => {
        try {
          await setupPromise;
        } catch (err) {
          release();
          throw err;
        }
        if (!engine || !timekeeper) {
          release();
          throw new Error('Video recording was cancelled before it started');
        }

        if (!timekeeper.getIsPaused()) timekeeper.pause();
        const durationMs = timekeeper.getElapsedMs();
        isStopped = true;
        if (rafId !== undefined) cancelAnimationFrame(rafId);
        snapshot?.finish();
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
      destroyPlayback();
      snapshot?.finish();
      engine?.cancel();
      release();
    },
    pause: async () => {
      if (isStopped || !timekeeper || timekeeper.getIsPaused()) return;
      timekeeper.pause();
      engine?.pause();
      await snapshot?.flushAndPause();
    },
    resume: () => {
      if (isStopped || !timekeeper?.getIsPaused()) return;
      destroyPlayback();
      timekeeper.resume();
      engine?.resume();
      snapshot?.resume();
    },
    whenReady: setupPromise,
    getElapsedMs: () => timekeeper?.getElapsedMs() ?? 0,
    getProfilePeaks: () => analyser.getCurrentPeaks(),
    get getPlaybackMedia() {
      return engine ? getPlaybackMedia : undefined;
    },
    getPlaybackEl: () => playbackVideo,
    destroyPlayback,
  };
}

async function resolveMediaDuration(media: HTMLVideoElement) {
  await new Promise<void>((resolve, reject) => {
    media.onloadedmetadata = () => resolve();
    media.onerror = () => reject(new Error('Failed to load recording snapshot'));
  });

  if (Number.isFinite(media.duration)) return;

  await new Promise<void>((resolve) => {
    const timeoutId = setTimeout(() => finish(), PLAYBACK_DURATION_TIMEOUT_MS);
    function finish() {
      clearTimeout(timeoutId);
      media.removeEventListener('durationchange', handleDurationChange);
      media.currentTime = 0;
      resolve();
    }
    function handleDurationChange() {
      if (Number.isFinite(media.duration)) {
        finish();
      }
    }
    media.addEventListener('durationchange', handleDurationChange);
    media.currentTime = Number.MAX_SAFE_INTEGER;
  });
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
  } catch (err) {
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

  const liveDeadline = Date.now() + VISIBLE_FRAME_TIMEOUT_MS;
  const sampledValuesCount = SAMPLE_SIZE * SAMPLE_SIZE * 3;
  let previousData: Uint8ClampedArray | undefined;
  let previousMean: number | undefined;
  let settleDeadline: number | undefined;
  let isLive = false;
  let settledFrames = 0;

  await new Promise<void>((resolve) => {
    const check = () => {
      // The warm-up (black frames) and the exposure ramp each get their own budget — a shared one would run
      // out during the ramp on a cold camera start and bake the brightness pumping into the clip
      const now = Date.now();
      if (isLive ? now >= settleDeadline! : now >= liveDeadline) {
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

        const mean = sum / sampledValuesCount;
        const isBrightEnough = mean > MIN_VISIBLE_LUMINANCE;
        const hasChanged = previousData && changeSum / sampledValuesCount > MIN_FRAME_CHANGE;
        if (!isLive && (isBrightEnough || hasChanged)) {
          isLive = true;
          settleDeadline = Date.now() + EXPOSURE_SETTLE_TIMEOUT_MS;
        }

        if (isLive && previousMean !== undefined) {
          if (Math.abs(mean - previousMean) < EXPOSURE_SETTLE_MAX_DELTA) {
            settledFrames++;
            if (settledFrames >= EXPOSURE_SETTLE_FRAMES) {
              resolve();
              return;
            }
          } else {
            settledFrames = 0;
          }
        }

        previousMean = mean;
        previousData = data;
      }

      requestAnimationFrame(check);
    };
    check();
  });
}
