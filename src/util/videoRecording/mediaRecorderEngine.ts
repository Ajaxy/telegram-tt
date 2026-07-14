import type { SnapshotRecorder, VideoRecorderEngine } from './types';

import { ROUND_AUDIO_BITRATE, ROUND_VIDEO_BITRATE, VIDEO_RECORDING_MIME_TYPE } from '../../config';

const MIME_CANDIDATES = [
  VIDEO_RECORDING_MIME_TYPE,
  'video/mp4',
];

// The final recording must be MP4 (the round-video format), but Chrome's MP4 muxer only emits
// matured fragments — `requestData` cannot flush the encoder tail, so partial MP4 data is
// unusable for the mid-recording preview. The preview therefore runs on a parallel WebM
// recorder, whose muxer flushes on demand; this is the deliberate price of instant re-watching.
const SNAPSHOT_MIME_CANDIDATES = [
  'video/webm;codecs=vp8,opus',
  'video/webm',
];
const SNAPSHOT_TIMESLICE_MS = 250;
const FLUSH_FALLBACK_TIMEOUT_MS = 1000;

export function recordWithMediaRecorder(
  videoTrack: MediaStreamTrack, audioTrack: MediaStreamTrack | undefined,
): VideoRecorderEngine {
  const stream = new MediaStream(audioTrack ? [videoTrack, audioTrack] : [videoTrack]);

  const mimeType = MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: ROUND_VIDEO_BITRATE,
    audioBitsPerSecond: ROUND_AUDIO_BITRATE,
  });

  // When no candidate is supported the browser picks the container itself — the actual
  // type is only reflected in `mediaRecorder.mimeType` after construction
  const getBaseMimeType = () => (mimeType || mediaRecorder.mimeType || 'video/mp4').split(';')[0];
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  mediaRecorder.onerror = (e) => {
    // eslint-disable-next-line no-console
    console.error('Round video recording error', e);
  };
  mediaRecorder.start();

  return {
    finalize: () => new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: getBaseMimeType() }));
      mediaRecorder.onerror = reject;

      try {
        mediaRecorder.stop();
      } catch (err) {
        reject(err);
      }
    }),
    cancel: () => {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    },
    pause: () => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
      }
    },
    resume: () => {
      if (mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
      }
    },
  };
}

export function createSnapshotRecorder(
  videoTrack: MediaStreamTrack, audioTrack: MediaStreamTrack | undefined,
): SnapshotRecorder | undefined {
  const mimeType = SNAPSHOT_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    return undefined;
  }

  const stream = new MediaStream(audioTrack ? [videoTrack, audioTrack] : [videoTrack]);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: ROUND_VIDEO_BITRATE,
      audioBitsPerSecond: ROUND_AUDIO_BITRATE,
    });
  } catch (err) {
    return undefined;
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.start(SNAPSHOT_TIMESLICE_MS);

  // Force out the buffered tail so the snapshot taken right after covers the whole recording.
  // Resolution requires at least one delivered `dataavailable` followed by a macrotask of
  // silence (the pending event set is finite once paused); the long timeout only covers
  // the event never arriving
  const flushAndPause = () => new Promise<void>((resolve) => {
    if (recorder.state !== 'recording') {
      resolve();
      return;
    }

    recorder.pause();

    let settleTimeout: number | undefined;
    const finish = () => {
      clearTimeout(settleTimeout);
      clearTimeout(fallbackTimeout);
      recorder.removeEventListener('dataavailable', handleData);
      resolve();
    };
    function handleData() {
      clearTimeout(fallbackTimeout);
      clearTimeout(settleTimeout);
      settleTimeout = window.setTimeout(finish, 0);
    }
    recorder.addEventListener('dataavailable', handleData);
    const fallbackTimeout = window.setTimeout(finish, FLUSH_FALLBACK_TIMEOUT_MS);

    try {
      recorder.requestData();
    } catch (err) {
      finish();
    }
  });

  return {
    flushAndPause,
    resume: () => {
      if (recorder.state === 'paused') {
        recorder.resume();
      }
    },
    finish: () => {
      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch (err) {
        // Already stopped
      }
    },
    getBlob: () => new Blob(chunks, { type: 'video/webm' }),
  };
}
