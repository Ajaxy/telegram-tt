import { useEffect, useRef, useState } from '../lib/teact/teact';

import useShowTransition from './useShowTransition';

const SPEED = {
  fast: 200,
  slow: 350,
};

export default (mediaData?: any, speed: keyof typeof SPEED = 'fast', noAnimate = false) => {
  const isMediaLoaded = Boolean(mediaData);
  const willAnimate = !useRef(isMediaLoaded).current && !noAnimate;
  const [shouldRenderThumb, setShouldRenderThumb] = useState(!isMediaLoaded);

  const {
    shouldRender: shouldRenderFullMedia,
    transitionClassNames,
  } = useShowTransition(isMediaLoaded, undefined, !willAnimate, speed);

  useEffect(() => {
    if (shouldRenderFullMedia) {
      if (willAnimate) {
        setTimeout(() => {
          setShouldRenderThumb(false);
        }, SPEED[speed]);
      } else {
        setShouldRenderThumb(false);
      }
    }
  }, [willAnimate, shouldRenderFullMedia, speed]);

  return {
    shouldRenderThumb,
    shouldRenderFullMedia,
    transitionClassNames,
  };
};
