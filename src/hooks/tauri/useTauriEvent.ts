import type { Event } from '@tauri-apps/api/event';
import { useEffect } from '../../lib/teact/teact';

import { IS_TAURI } from '../../util/browser/globalEnvironment';

export default function useTauriEvent<T>(name: string, callback: (event: Event<T>) => void) {
  return useEffect(() => {
    if (!IS_TAURI) {
      return undefined;
    }

    let removeListener: VoidFunction | undefined;

    const setUpListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      removeListener = await listen<T>(name, (event) => {
        callback(event);
      });
    };

    setUpListener().catch((error) => {
      // eslint-disable-next-line no-console
      console.error(`Could not set up window event listener. ${error}`);
    });

    return () => {
      removeListener?.();
    };
  }, [name, callback]);
}
