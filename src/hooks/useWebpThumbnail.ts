import { useLayoutEffect, useState } from '../lib/teact/teact';

import { ApiMessage } from '../api/types';

import { DEBUG } from '../config';
import { isWebpSupported } from '../util/environment';
import { EMPTY_IMAGE_DATA_URI, webpToPngBase64 } from '../util/webpToPng';
import { getMessageMediaThumbDataUri } from '../modules/helpers';

export default function useWebpThumbnail(message?: ApiMessage) {
  const thumbnail = message && getMessageMediaThumbDataUri(message);
  const sticker = message?.content?.sticker;
  const shouldDecodeThumbnail = thumbnail && sticker && !isWebpSupported() && thumbnail.includes('image/webp');
  const [thumbnailDecoded, setThumbnailDecoded] = useState(EMPTY_IMAGE_DATA_URI);
  const messageId = message?.id;

  useLayoutEffect(() => {
    if (!shouldDecodeThumbnail) {
      return;
    }

    webpToPngBase64(`b64-${messageId}`, thumbnail!)
      .then(setThumbnailDecoded)
      .catch((err) => {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
  }, [messageId, shouldDecodeThumbnail, thumbnail]);

  return shouldDecodeThumbnail ? thumbnailDecoded : thumbnail;
}
