import { ApiMessage } from '../../../../api/types';

import { IS_CANVAS_FILTER_SUPPORTED, IS_SINGLE_COLUMN_LAYOUT } from '../../../../util/environment';
import { getMessageMediaThumbDataUri } from '../../../../modules/helpers';
import useCanvasBlur from '../../../../hooks/useCanvasBlur';

export default function useBlurredMediaThumbRef(message: ApiMessage, fullMediaData?: string) {
  return useCanvasBlur(
    getMessageMediaThumbDataUri(message),
    Boolean(fullMediaData),
    IS_SINGLE_COLUMN_LAYOUT && !IS_CANVAS_FILTER_SUPPORTED,
  );
}
