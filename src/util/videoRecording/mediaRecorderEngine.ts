import type { VideoRecorderEngine } from './types';

import { ROUND_AUDIO_BITRATE, ROUND_VIDEO_BITRATE, VIDEO_RECORDING_MIME_TYPE } from '../../config';

const MIME_CANDIDATES = [
  VIDEO_RECORDING_MIME_TYPE,
  'video/mp4',
];

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

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  mediaRecorder.start();

  return {
    finalize: () => new Promise<Blob>((resolve, reject) => {
      const baseMimeType = (mediaRecorder.mimeType || 'video/mp4').split(';')[0];
      mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: baseMimeType }));
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
  };
}
