import { useEffect, useState } from '../lib/teact/teact';

import type { ApiPeer } from '../api/types';
import { ApiMediaFormat } from '../api/types';

import { getChatAvatarHash } from '../global/helpers';
import { getAverageColor, rgb2hex } from '../util/colors';
import useMedia from './useMedia';

function useAverageColor(peer: ApiPeer, fallbackColor = '#00000000') {
  const [color, setColor] = useState(fallbackColor);
  const imgBlobUrl = useMedia(getChatAvatarHash(peer), false, ApiMediaFormat.BlobUrl);

  useEffect(() => {
    (async () => {
      if (!imgBlobUrl) {
        return;
      }

      const averageColor = await getAverageColor(imgBlobUrl);
      setColor(rgb2hex(averageColor));
    })();
  }, [imgBlobUrl]);

  return color;
}

export default useAverageColor;
