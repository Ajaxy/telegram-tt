import { getMediaThumbUri, type MediaWithThumbs } from '../../../../global/helpers';
import { IS_CANVAS_FILTER_SUPPORTED } from '../../../../util/windowEnvironment';

import useAppLayout from '../../../../hooks/useAppLayout';
import useCanvasBlur from '../../../../hooks/useCanvasBlur';

type CanvasBlurReturnType = ReturnType<typeof useCanvasBlur>;

export default function useBlurredMediaThumbRef(
  forcedUri: string | undefined, isDisabled: boolean,
): CanvasBlurReturnType;
export default function useBlurredMediaThumbRef(media: MediaWithThumbs, isDisabled?: boolean) : CanvasBlurReturnType;
export default function useBlurredMediaThumbRef(
  media: MediaWithThumbs | string | undefined,
  isDisabled?: boolean,
) {
  const { isMobile } = useAppLayout();

  const dataUri = media ? typeof media === 'string' ? media : getMediaThumbUri(media) : undefined;

  return useCanvasBlur(
    dataUri,
    isDisabled,
    isMobile && !IS_CANVAS_FILTER_SUPPORTED,
  );
}
