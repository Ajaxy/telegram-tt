import { useEffect, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { IS_MOBILE } from '../../util/windowEnvironment';
import useLastCallback from '../useLastCallback';
import useOldLang from '../useOldLang';

const NOTIFICATION_DURATION = 8000;

export default function useUnsupportedMedia(
  ref: React.RefObject<HTMLVideoElement>, shouldDisableNotification?: boolean, isDisabled?: boolean,
) {
  const { showNotification } = getActions();
  const lang = useOldLang();
  const [isUnsupported, setIsUnsupported] = useState(false);

  const handleUnsupported = useLastCallback(() => {
    setIsUnsupported(true);
    if (shouldDisableNotification) return;

    showNotification({
      message: IS_MOBILE ? lang('Video.Unsupported.Mobile') : lang('Video.Unsupported.Desktop'),
      duration: NOTIFICATION_DURATION,
    });
  });

  const onError = useLastCallback((event: Event) => {
    const target = event.currentTarget as HTMLVideoElement;
    const { error } = target;
    if (!error) return;

    // https://developer.mozilla.org/en-US/docs/Web/API/MediaError/code
    if (error.code === 3 || error.code === 4) {
      handleUnsupported();
    }
  });

  const onCanPlay = useLastCallback((event: Event) => {
    const target = event.currentTarget as HTMLVideoElement;

    if (!target.videoHeight || !target.videoWidth) {
      handleUnsupported();
    }
  });

  useEffect(() => {
    if (isDisabled) return undefined;

    const { current } = ref;
    if (!current) {
      return undefined;
    }

    current.addEventListener('error', onError);
    current.addEventListener('canplay', onCanPlay);

    return () => {
      current.removeEventListener('error', onError);
      current.removeEventListener('canplay', onCanPlay);
    };
  }, [isDisabled, ref]);

  return isUnsupported;
}
