import { useEffect } from '../../../lib/teact/teact';

import type { ApiPhoto } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';

import * as mediaLoader from '../../../util/mediaLoader';

const PHOTOS_TO_PRELOAD = 4;

export default function usePhotosPreload(
  photos: ApiPhoto[],
  currentIndex: number,
) {
  useEffect(() => {
    photos.slice(currentIndex, currentIndex + PHOTOS_TO_PRELOAD).forEach((photo) => {
      const mediaData = mediaLoader.getFromMemory(`photo${photo.id}?size=c`);
      if (!mediaData) {
        mediaLoader.fetch(`photo${photo.id}?size=c`, ApiMediaFormat.BlobUrl);
      }
    });
  }, [currentIndex, photos]);
}
