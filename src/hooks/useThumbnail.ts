import { useLayoutEffect, useMemo, useState } from '../lib/teact/teact';

import type { ApiMessage, ApiSticker } from '../api/types';

import { DEBUG } from '../config';
import { isWebpSupported } from '../util/environment';
import { EMPTY_IMAGE_DATA_URI, webpToPngBase64 } from '../util/webpToPng';
import { getMessageMediaThumbDataUri } from '../global/helpers';
import { selectTheme } from '../global/selectors';
import { getGlobal } from '../global';

export default function useThumbnail(media?: ApiMessage | ApiSticker) {
  const isMessage = media && 'content' in media;
  const thumbDataUri = isMessage ? getMessageMediaThumbDataUri(media) : media?.thumbnail?.dataUri;
  const sticker = isMessage ? media.content?.sticker : media;
  const shouldDecodeThumbnail = thumbDataUri && sticker && !isWebpSupported() && thumbDataUri.includes('image/webp');
  const [thumbnailDecoded, setThumbnailDecoded] = useState(EMPTY_IMAGE_DATA_URI);
  const id = media?.id;

  useLayoutEffect(() => {
    if (!shouldDecodeThumbnail) {
      return;
    }

    webpToPngBase64(`b64-${id}`, thumbDataUri!)
      .then(setThumbnailDecoded)
      .catch((err) => {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
  }, [id, shouldDecodeThumbnail, thumbDataUri]);

  // TODO Find a way to update thumbnail on theme change
  const theme = selectTheme(getGlobal());

  const dataUri = useMemo(() => {
    const uri = shouldDecodeThumbnail ? thumbnailDecoded : thumbDataUri;
    if (!uri || theme !== 'dark') return uri;

    return uri.replace('<svg', '<svg fill="white"');
  }, [shouldDecodeThumbnail, thumbDataUri, thumbnailDecoded, theme]);

  return dataUri;
}
