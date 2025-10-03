import { requestMeasure } from '../lib/fasterdom/fasterdom';

export type VideoRecordingResult = { 
  blob: Blob; 
  duration: number; 
  filename: string;
};

const MIN_RECORDING_TIME = 1000;
const VIDEO_BLOB_PARAMS = { type: 'video/webm' };

let mediaRecorder: MediaRecorder | undefined;
let recordingChunks: Blob[] = [];

export async function startVideoRecording(stream: MediaStream, filename: string): Promise<{
  stop: () => Promise<VideoRecordingResult>;
  pause: () => void;
  resume: () => void;
}> {
  if (!stream) {
    throw new Error('No stream provided for recording');
  }

  // Check if MediaRecorder is supported
  if (!window.MediaRecorder) {
    throw new Error('MediaRecorder is not supported in this browser');
  }

  // Check if the stream has video tracks
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length === 0) {
    throw new Error('No video tracks found in the stream');
  }

  // Get supported MIME types
  const supportedTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];

  let mimeType = '';
  for (const type of supportedTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      mimeType = type;
      break;
    }
  }

  if (!mimeType) {
    throw new Error('No supported video MIME type found');
  }

  const options: MediaRecorderOptions = {
    mimeType,
    videoBitsPerSecond: 2500000, // 2.5 Mbps
  };

  mediaRecorder = new MediaRecorder(stream, options);
  recordingChunks = [];

  const startedAt = Date.now();
  let pausedAt: number | undefined;

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordingChunks.push(event.data);
    }
  };

  return {
    stop: () => new Promise<VideoRecordingResult>((resolve, reject) => {
      if (!mediaRecorder) {
        reject(new Error('MediaRecorder is not initialized'));
        return;
      }

      mediaRecorder.onstop = () => {
        const duration = Math.round(((pausedAt || Date.now()) - startedAt) / 1000);
        const blob = new Blob(recordingChunks, { 
          type: mimeType || VIDEO_BLOB_PARAMS.type 
        });
        
        resolve({
          blob,
          duration,
          filename: `${filename}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`,
        });
      };

      mediaRecorder.onerror = (event) => {
        reject(new Error(`Recording error: ${event}`));
      };

      const delayStop = Math.max(0, startedAt + MIN_RECORDING_TIME - Date.now());
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, delayStop);
    }),

    pause: () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        pausedAt = Date.now();
      }
    },

    resume: () => {
      if (mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        pausedAt = undefined;
      }
    },
  };
}

export function downloadVideoBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  requestMeasure(() => {
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

export function isVideoRecordingSupported(): boolean {
  return Boolean(
    window.MediaRecorder && 
    window.navigator.mediaDevices && 
    'getUserMedia' in window.navigator.mediaDevices
  );
}
