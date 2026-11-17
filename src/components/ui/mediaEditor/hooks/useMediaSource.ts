import { useEffect, useState } from '@teact';

import type { Size } from '../render/transform';
import type { VideoProbe } from '../types';

import { SUPPORTED_VIDEO_CONTENT_TYPES } from '../../../../config';
import { fetchBlob, preloadImage } from '../../../../util/files';
import { waitForVideoFrame } from '../export/renderVideoElementFrame';
import { fetchVideoProbe } from '../export/videoProbe';

export type MediaSource = {
  kind: 'photo';
  frame: HTMLImageElement;
  size: Size;
} | {
  kind: 'video';
  frame: HTMLVideoElement;
  size: Size;
  blob: Blob;
  probe?: VideoProbe;
};

type MediaSourceState = {
  source?: MediaSource;
  isError?: true;
};

const knownSizes = new Map<string, Size>();

export function getKnownMediaSize(blobUrl: string) {
  return knownSizes.get(blobUrl);
}

export default function useMediaSource(blobUrl?: string, mimeType?: string, initialVideoTime?: number) {
  const [state, setState] = useState<MediaSourceState>({});

  useEffect(() => {
    setState({});
    if (!blobUrl) return undefined;

    let isCancelled = false;
    const setSource = (source: MediaSource) => {
      if (isCancelled) return;
      knownSizes.set(blobUrl, source.size);
      setState({ source });
    };
    const setError = () => {
      if (!isCancelled) setState({ isError: true });
    };

    if (!mimeType || !SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
      preloadImage(blobUrl).then((image) => {
        setSource({ kind: 'photo', frame: image, size: { width: image.width, height: image.height } });
      }).catch(setError);

      return () => {
        isCancelled = true;
      };
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = blobUrl;

    Promise.all([
      waitForVideoFrame(video, initialVideoTime),
      fetchBlob(blobUrl),
      fetchVideoProbe(blobUrl),
    ]).then(([, blob, probe]) => {
      setSource({
        kind: 'video',
        frame: video,
        size: { width: video.videoWidth, height: video.videoHeight },
        blob,
        probe,
      });
    }).catch(setError);

    return () => {
      isCancelled = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [blobUrl, mimeType, initialVideoTime]);

  return state;
}
