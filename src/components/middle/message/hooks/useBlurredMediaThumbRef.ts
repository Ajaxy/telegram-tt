import { getMediaThumbUri, type MediaWithThumbs } from '../../../../global/helpers';

import useOffscreenCanvasBlur from '../../../../hooks/useOffscreenCanvasBlur';

type CanvasBlurReturnType = ReturnType<typeof useOffscreenCanvasBlur>;

export default function useBlurredMediaThumbRef(
  forcedUri: string | undefined, isDisabled: boolean,
): CanvasBlurReturnType;
export default function useBlurredMediaThumbRef(media: MediaWithThumbs, isDisabled?: boolean) : CanvasBlurReturnType;
export default function useBlurredMediaThumbRef(
  media: MediaWithThumbs | string | undefined,
  isDisabled?: boolean,
) {
  const dataUri = media ? typeof media === 'string' ? media : getMediaThumbUri(media) : undefined;

  return useOffscreenCanvasBlur(dataUri, isDisabled);
}
