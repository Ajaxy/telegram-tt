import { useUnmountCleanup } from '../../../lib/teact/teact';

import { createSignal } from '../../../util/signals';

const [getZoomChange, setZoomChange] = createSignal(1);

export default function useZoomChange() {
  useUnmountCleanup(() => {
    setZoomChange(1);
  });

  return [getZoomChange, setZoomChange] as const;
}
