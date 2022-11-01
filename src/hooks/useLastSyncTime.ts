import { useEffect, useState } from '../lib/teact/teact';
import { addCallback } from '../lib/teact/teactn';
import { getGlobal } from '../global';

import type { GlobalState } from '../global/types';

type LastSyncTimeSetter = (time: number) => void;

const handlers = new Set<LastSyncTimeSetter>();
let prevGlobal: GlobalState | undefined;

addCallback((global: GlobalState) => {
  if (global.lastSyncTime && global.lastSyncTime !== prevGlobal?.lastSyncTime) {
    for (const handler of handlers) {
      handler(global.lastSyncTime);
    }
  }

  prevGlobal = global;
});

export default function useLastSyncTime() {
  const [lastSyncTime, setLastSyncTime] = useState(getGlobal().lastSyncTime);

  useEffect(() => {
    handlers.add(setLastSyncTime);

    return () => {
      handlers.delete(setLastSyncTime);
    };
  }, []);

  return lastSyncTime;
}
