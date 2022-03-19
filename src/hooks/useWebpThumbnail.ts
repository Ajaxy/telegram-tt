import { useLayoutEffect, useState } from '../lib/teact/teact';

import { ApiMessage } from '../api/types';

import { DEBUG } from '../config';
import { isWebpSupported } from '../util/environment';
import { EMPTY_IMAGE_DATA_URI, webpToPngBase64 } from '../util/webpToPng';
import { getMessageMediaThumbDataUri } from '../global/helpers';

export default function useWebpThumbnail(message?: ApiMessage) {
  const thumbDataUri = message && getMessageMediaThumbDataUri(message);
  const sticker = message?.content?.sticker;
  const shouldDecodeThumbnail = thumbDataUri && sticker && !isWebpSupported() && thumbDataUri.includes('image/webp');
  const [thumbnailDecoded, setThumbnailDecoded] = useState(EMPTY_IMAGE_DATA_URI);
  const messageId = message?.id;

  useLayoutEffect(() => {
    if (!shouldDecodeThumbnail) {
      return;
    }

    webpToPngBase64(`b64-${messageId}`, thumbDataUri!)
      .then(setThumbnailDecoded)
      .catch((err) => {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error(err);
        }
      });
  }, [messageId, shouldDecodeThumbnail, thumbDataUri]);

  return shouldDecodeThumbnail ? thumbnailDecoded : thumbDataUri;
}
