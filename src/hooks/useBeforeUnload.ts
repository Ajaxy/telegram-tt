import { useEffect } from '../lib/teact/teact';

import { onBeforeUnload } from '../util/schedulers';

export default function useBeforeUnload(callback: AnyToVoidFunction) {
  useEffect(() => {
    return onBeforeUnload(callback);
  }, [callback]);
}
