import type { ApiMessage } from '../../../../api/types';

import { IS_CANVAS_FILTER_SUPPORTED } from '../../../../util/environment';
import { getMessageMediaThumbDataUri } from '../../../../global/helpers';
import useCanvasBlur from '../../../../hooks/useCanvasBlur';
import useAppLayout from '../../../../hooks/useAppLayout';

export default function useBlurredMediaThumbRef(message: ApiMessage, isDisabled?: boolean | string) {
  const { isMobile } = useAppLayout();

  return useCanvasBlur(
    getMessageMediaThumbDataUri(message),
    Boolean(isDisabled),
    isMobile && !IS_CANVAS_FILTER_SUPPORTED,
  );
}
