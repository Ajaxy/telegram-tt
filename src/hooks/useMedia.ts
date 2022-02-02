import { useEffect } from '../lib/teact/teact';

import { ApiMediaFormat } from '../api/types';

import * as mediaLoader from '../util/mediaLoader';
import useForceUpdate from './useForceUpdate';

const useMedia =  <T extends ApiMediaFormat = ApiMediaFormat.BlobUrl>(
  mediaHash: string | false | undefined,
  noLoad = false,
  // @ts-ignore (workaround for "could be instantiated with a different subtype" issue)
  mediaFormat: T = ApiMediaFormat.BlobUrl,
  cacheBuster?: number,
  delay?: number | false,
) => {
  const mediaData = mediaHash ? mediaLoader.getFromMemory(mediaHash) : undefined;
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    if (!noLoad && mediaHash && !mediaData) {
      const startedAt = Date.now();

      mediaLoader.fetch(mediaHash, mediaFormat).then(() => {
        const spentTime = Date.now() - startedAt;
        if (!delay || spentTime >= delay) {
          forceUpdate();
        } else {
          setTimeout(forceUpdate, delay - spentTime);
        }
      });
    }
  }, [noLoad, mediaHash, mediaData, mediaFormat, cacheBuster, forceUpdate, delay]);

  return mediaData;
};

export default useMedia;
