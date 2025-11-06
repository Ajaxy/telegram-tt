import {
  useEffect, useMemo, useRef, useState,
} from '../lib/teact/teact';

import { ApiMediaFormat } from '../api/types';

import { selectIsSynced } from '../global/selectors';
import { IS_PROGRESSIVE_SUPPORTED } from '../util/browser/windowEnvironment';
import * as mediaLoader from '../util/mediaLoader';
import { throttle } from '../util/schedulers';
import useSelector from './data/useSelector';
import useForceUpdate from './useForceUpdate';
import useUniqueId from './useUniqueId';

const STREAMING_PROGRESS = 0.75;
const STREAMING_TIMEOUT = 1500;
const PROGRESS_THROTTLE = 500;

export default function useMediaWithLoadProgress(
  mediaHash: string | undefined,
  noLoad = false,
  mediaFormat = ApiMediaFormat.BlobUrl,
  delay?: number | false,
  isHtmlAllowed = false,
) {
  const isStreaming = IS_PROGRESSIVE_SUPPORTED && mediaFormat === ApiMediaFormat.Progressive;
  const mediaData = mediaHash
    ? (isStreaming && !noLoad ? mediaLoader.getProgressiveUrl(mediaHash)
      : mediaLoader.getFromMemory(mediaHash)) : undefined;

  const forceUpdate = useForceUpdate();
  const isSynced = useSelector(selectIsSynced);
  const id = useUniqueId();
  const [loadProgress, setLoadProgress] = useState(mediaData && !isStreaming ? 1 : 0);
  const startedAtRef = useRef<number>();

  const handleProgress = useMemo(() => {
    return throttle((progress: number) => {
      if (startedAtRef.current && (!delay || (Date.now() - startedAtRef.current > delay))) {
        setLoadProgress(progress);
      }
    }, PROGRESS_THROTTLE, true);
  }, [delay]);

  useEffect(() => {
    if (!noLoad && mediaHash) {
      if (!mediaData) {
        setLoadProgress(0);

        if (startedAtRef.current) {
          mediaLoader.cancelProgress(handleProgress);
        }

        startedAtRef.current = Date.now();

        mediaLoader.fetch(mediaHash, mediaFormat, isHtmlAllowed, handleProgress, id).then(() => {
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
          setLoadProgress(STREAMING_PROGRESS);
        }, STREAMING_TIMEOUT);
      }
    }
  }, [
    noLoad, mediaHash, mediaData, mediaFormat, isStreaming, delay, handleProgress, isHtmlAllowed, id, isSynced,
  ]);

  useEffect(() => {
    if (noLoad && startedAtRef.current) {
      mediaLoader.cancelProgress(handleProgress);
      setLoadProgress(0);
      startedAtRef.current = undefined;
    }
  }, [handleProgress, noLoad]);

  useEffect(() => {
    return () => {
      if (mediaHash) {
        mediaLoader.removeCallback(mediaHash, id);
      }
    };
  }, [id, mediaHash]);

  return { mediaData, loadProgress };
}
