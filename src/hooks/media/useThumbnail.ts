import { useMemo } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { ApiThumbnail, MediaContainer } from '../../api/types';

import { selectTheme } from '../../global/selectors';
import { selectMessageMediaThumbDataUri } from '../../global/selectors/media';

export default function useThumbnail(media?: MediaContainer | ApiThumbnail) {
  const isMediaContainer = media && 'content' in media;
  const global = getGlobal();
  const thumbDataUri = isMediaContainer ? selectMessageMediaThumbDataUri(global, media) : media?.dataUri;

  // TODO Find a way to update thumbnail on theme change
  const theme = selectTheme(global);

  const dataUri = useMemo(() => {
    const uri = thumbDataUri;
    if (!uri || theme !== 'dark') return uri;

    return uri.replace('<svg', '<svg fill="white"');
  }, [thumbDataUri, theme]);

  return dataUri;
}
