import { useRef } from '../lib/teact/teact';

import fastBlur from '../lib/fastBlur';
import { imgToCanvas } from '../util/files';
import useBlur from './useBlur';
import useSyncEffect from './useSyncEffect';

const RADIUS = 2;
const ITERATIONS = 2;

export default function useBlurSync(dataUri: string | false | undefined) {
  const blurredRef = useRef<string>();

  let isChanged = false;

  useSyncEffect(() => {
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
    isChanged = true;

    blurredRef.current = undefined;

    if (!dataUri) {
      return;
    }

    const img = new Image();
    img.src = dataUri;
    if (!img.width) {
      return;
    }

    const canvas = imgToCanvas(img);
    fastBlur(canvas.getContext('2d'), 0, 0, canvas.width, canvas.height, RADIUS, ITERATIONS);

    blurredRef.current = canvas.toDataURL();
  }, [dataUri]);

  // Sometimes `Image` do not manage to load synchronously,
  // so we fall back the non-blurred variant and prepare the async one at least for the next time
  const blurredAsync = useBlur(dataUri || undefined, Boolean(blurredRef.current));

  return blurredRef.current || (!isChanged && blurredAsync) || dataUri || undefined;
}
