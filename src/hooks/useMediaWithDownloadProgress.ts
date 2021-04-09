import {
  useEffect, useMemo, useRef, useState,
} from '../lib/teact/teact';

import { IS_PROGRESSIVE_SUPPORTED } from '../util/environment';
import { ApiMediaFormat } from '../api/types';
import { throttle } from '../util/schedulers';
import * as mediaLoader from '../util/mediaLoader';
import useForceUpdate from './useForceUpdate';

const STREAMING_PROGRESS = 0.75;
const STREAMING_TIMEOUT = 1500;
const PROGRESS_THROTTLE = 500;

export default <T extends ApiMediaFormat = ApiMediaFormat.BlobUrl>(
  mediaHash: string | undefined,
  noLoad = false,
  // @ts-ignore (workaround for "could be instantiated with a different subtype" issue)
  mediaFormat: T = ApiMediaFormat.BlobUrl,
  cacheBuster?: number,
  delay?: number | false,
) => {
  const mediaData = mediaHash ? mediaLoader.getFromMemory<T>(mediaHash) : undefined;
  const isStreaming = mediaFormat === ApiMediaFormat.Stream || (
    IS_PROGRESSIVE_SUPPORTED && mediaFormat === ApiMediaFormat.Progressive
  );
  const forceUpdate = useForceUpdate();
  const [downloadProgress, setDownloadProgress] = useState(mediaData && !isStreaming ? 1 : 0);
  const startedAtRef = useRef<number>();

  const handleProgress = useMemo(() => {
    return throttle((progress: number) => {
      if (!delay || (Date.now() - startedAtRef.current! > delay)) {
        setDownloadProgress(progress);
      }
    }, PROGRESS_THROTTLE, true);
  }, [delay]);

  useEffect(() => {
    if (!noLoad && mediaHash) {
      if (!mediaData) {
        setDownloadProgress(0);

        if (startedAtRef.current) {
          mediaLoader.cancelProgress(handleProgress);
        }

        startedAtRef.current = Date.now();

        mediaLoader.fetch(mediaHash, mediaFormat, handleProgress).then(() => {
          const spentTime = Date.now() - startedAtRef.current!;
          startedAtRef.current = undefined;

          if (!delay || spentTime >= delay) {
            forceUpdate();
          } else {
            setTimeout(forceUpdate, delay - spentTime);
          }
        });
      } else if (isStreaming) {
        setTimeout(() => {
          setDownloadProgress(STREAMING_PROGRESS);
        }, STREAMING_TIMEOUT);
      }
    }
  }, [noLoad, mediaHash, mediaData, mediaFormat, cacheBuster, forceUpdate, isStreaming, delay, handleProgress]);

  useEffect(() => {
    if (noLoad && startedAtRef.current) {
      mediaLoader.cancelProgress(handleProgress);
      setDownloadProgress(0);
    }
  }, [handleProgress, noLoad]);

  return { mediaData, downloadProgress };
};
