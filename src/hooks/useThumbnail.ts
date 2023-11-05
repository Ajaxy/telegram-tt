import { useMemo } from '../lib/teact/teact';
import { getGlobal } from '../global';

import type { ApiMessage, ApiSticker } from '../api/types';

import { getMessageMediaThumbDataUri } from '../global/helpers';
import { selectTheme } from '../global/selectors';

type MediaContainer = Pick<ApiMessage, 'content'>;

export default function useThumbnail(media?: MediaContainer | ApiSticker) {
  const isMediaContainer = media && 'content' in media;
  const thumbDataUri = isMediaContainer ? getMessageMediaThumbDataUri(media) : media?.thumbnail?.dataUri;

  // TODO Find a way to update thumbnail on theme change
  const theme = selectTheme(getGlobal());

  const dataUri = useMemo(() => {
    const uri = thumbDataUri;
    if (!uri || theme !== 'dark') return uri;

    return uri.replace('<svg', '<svg fill="white"');
  }, [thumbDataUri, theme]);

  return dataUri;
}
