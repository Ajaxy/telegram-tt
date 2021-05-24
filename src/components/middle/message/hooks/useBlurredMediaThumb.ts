import { ApiMessage } from '../../../../api/types';

import { LAYERS_TRANSITION_DURATION } from '../../../../config';
import { IS_MOBILE_SCREEN } from '../../../../util/environment';
import { getMessageMediaThumbDataUri } from '../../../../modules/helpers';
import useBlur from '../../../../hooks/useBlur';

export default function useBlurredMediaThumb(message: ApiMessage, fullMediaData?: string) {
  return useBlur(
    getMessageMediaThumbDataUri(message),
    Boolean(fullMediaData),
    IS_MOBILE_SCREEN ? LAYERS_TRANSITION_DURATION : undefined,
  );
}
