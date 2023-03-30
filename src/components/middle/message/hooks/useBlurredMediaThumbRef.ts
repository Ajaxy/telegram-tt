import type { ApiMessage } from '../../../../api/types';

import { IS_CANVAS_FILTER_SUPPORTED } from '../../../../util/windowEnvironment';
import { getMessageMediaThumbDataUri } from '../../../../global/helpers';
import useCanvasBlur from '../../../../hooks/useCanvasBlur';
import useAppLayout from '../../../../hooks/useAppLayout';

export default function useBlurredMediaThumbRef(
  message: ApiMessage,
  isDisabled?: boolean | string,
  forcedUri?: string,
) {
  const { isMobile } = useAppLayout();

  const dataUri = forcedUri || getMessageMediaThumbDataUri(message);

  return useCanvasBlur(
    dataUri,
    Boolean(isDisabled),
    isMobile && !IS_CANVAS_FILTER_SUPPORTED,
  );
}
