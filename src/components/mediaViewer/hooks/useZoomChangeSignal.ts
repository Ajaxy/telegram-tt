import { createSignal } from '../../../util/signals';
import { useEffect } from '../../../lib/teact/teact';

const [getZoomChange, setZoomChange] = createSignal(1);

export default function useZoomChange() {
  useEffect(() => {
    return () => {
      setZoomChange(1);
    };
  }, []);

  return [getZoomChange, setZoomChange] as const;
}
