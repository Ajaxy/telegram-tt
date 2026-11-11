import type { VideoProbe } from '../types';

import { fetchBlob } from '../../../../util/files';
import { requestVideoProcessing } from '../../../../util/launchVideoProcessingWorker';

const cache = new Map<string, Promise<VideoProbe | undefined>>();

export function fetchVideoProbe(blobUrl: string) {
  let result = cache.get(blobUrl);
  if (!result) {
    result = fetchBlob(blobUrl).then((blob) => (
      requestVideoProcessing({ name: 'probe', args: [blob] }) as Promise<VideoProbe | undefined>
    ));
    cache.set(blobUrl, result);
    result.catch(() => cache.delete(blobUrl));
  }

  return result;
}
