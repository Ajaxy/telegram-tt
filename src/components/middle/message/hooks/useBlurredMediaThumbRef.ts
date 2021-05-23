import { ApiMessage } from '../../../../api/types';

import { IS_CANVAS_FILTER_SUPPORTED, IS_MOBILE_SCREEN } from '../../../../util/environment';
import { getMessageMediaThumbDataUri } from '../../../../modules/helpers';
import useCanvasBlur from '../../../../hooks/useCanvasBlur';

export default function useBlurredMediaThumbRef(message: ApiMessage, fullMediaData?: string) {
  return useCanvasBlur(
    getMessageMediaThumbDataUri(message),
    Boolean(fullMediaData),
    IS_MOBILE_SCREEN && !IS_CANVAS_FILTER_SUPPORTED,
  );
}
