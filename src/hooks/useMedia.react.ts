import { useEffect } from 'react';

import { ApiMediaFormat } from '../api/types';

import * as mediaLoader from '../util/mediaLoader';
import useForceUpdate from './useForceUpdate.react';

const useMedia = (
  mediaHash: string | false | undefined,
  noLoad = false,
  mediaFormat = ApiMediaFormat.BlobUrl,
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
  }, [noLoad, mediaHash, mediaData, mediaFormat, forceUpdate, delay]);

  return mediaData;
};

export default useMedia;
