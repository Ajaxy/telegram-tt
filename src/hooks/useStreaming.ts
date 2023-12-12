import type { RefObject } from 'react';
import { useEffect } from '../lib/teact/teact';

import { DEBUG } from '../config';
import { requestMutation } from '../lib/fasterdom/fasterdom';
import { applyStyles } from '../util/animation';
import { makeProgressiveLoader } from '../util/progressieveLoader';
import { IS_SAFARI } from '../util/windowEnvironment';

const VIDEO_REVEAL_DELAY = 100;

export function useStreaming(videoRef: RefObject<HTMLVideoElement>, url?: string, mimeType?: string) {
  useEffect(() => {
    if (!url || !videoRef.current) return undefined;
    const MediaSourceClass = getMediaSource();
    const video = videoRef.current;

    if (!IS_SAFARI || !mimeType || !MediaSourceClass?.isTypeSupported(mimeType)) {
      return undefined;
    }
    const mediaSource = new MediaSourceClass();

    function revealVideo() {
      requestMutation(() => {
        video.style.display = 'block';
        setTimeout(() => {
          requestMutation(() => {
            applyStyles(video, { opacity: '1' });
          });
        }, VIDEO_REVEAL_DELAY);
      });
    }

    function onSourceOpen() {
      if (!url || !mimeType) return;

      const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
      const loader = makeProgressiveLoader(url);

      function onUpdateEnded() {
        loader.next()
          .then(({
            value,
            done,
          }) => {
            if (mediaSource.readyState !== 'open') return;
            if (done) {
              endOfStream(mediaSource);
              return;
            }
            appendBuffer(sourceBuffer, value);
          });
      }

      sourceBuffer.addEventListener('updateend', onUpdateEnded);

      loader.next()
        .then(({
          value,
          done,
        }) => {
          if (done || mediaSource.readyState !== 'open') return;
          revealVideo();
          appendBuffer(sourceBuffer, value);
        });
    }

    mediaSource.addEventListener('sourceopen', onSourceOpen, { once: true });

    requestMutation(() => {
      applyStyles(video, {
        display: 'none',
        opacity: '0',
      });
      video.src = URL.createObjectURL(mediaSource);
    });

    return () => {
      mediaSource.removeEventListener('sourceopen', onSourceOpen);
      if (mediaSource.readyState === 'open') {
        endOfStream(mediaSource);
      }
      URL.revokeObjectURL(video.src);
      requestMutation(() => {
        video.src = '';
        applyStyles(video, {
          display: 'none',
          opacity: '0',
        });
      });
    };
  }, [mimeType, url, videoRef]);
}

export function checkIfStreamingSupported(mimeType: string) {
  if (!IS_SAFARI) return false;
  const MS = getMediaSource();
  return Boolean(MS && MS.isTypeSupported(mimeType));
}

function appendBuffer(sourceBuffer: SourceBuffer, buffer: ArrayBuffer) {
  try {
    sourceBuffer.appendBuffer(buffer);
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[Stream] failed to append buffer', error);
    }
  }
}

function endOfStream(mediaSource: MediaSource) {
  try {
    mediaSource.endOfStream();
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[Stream] failed to end stream', error);
    }
  }
}

function getMediaSource(): typeof MediaSource | undefined {
  if ('ManagedMediaSource' in window) {
    // @ts-ignore
    return ManagedMediaSource;
  }
  if ('MediaSource' in window) {
    return MediaSource;
  }
  return undefined;
}
