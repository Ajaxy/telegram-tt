import { useState } from '../../lib/teact/teact';

import { createCallbackManager } from '../../util/callbacks';
import useEffectOnce from '../useEffectOnce';

const callbacks = createCallbackManager();

function createListener() {
  window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    .addEventListener('change', callbacks.runCallbacks, { once: true });
}

export default function useDevicePixelRatio() {
  const [dpr, setDpr] = useState(window.devicePixelRatio);

  useEffectOnce(() => {
    callbacks.addCallback(() => {
      setDpr(window.devicePixelRatio);
    });
  });

  return dpr;
}

createListener();

// Set up new listener for the next `devicePixelRatio` change
callbacks.addCallback(createListener);
