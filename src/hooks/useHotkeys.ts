// Original source from Mantine
// https://github.com/mantinedev/mantine/blob/master/src/mantine-hooks/src/use-hotkeys/

import { useEffect } from '../lib/teact/teact';
import { getHotkeyHandler, getHotkeyMatcher } from '../util/parseHotkey';

export { getHotkeyHandler };

export type HotkeyItem = [string, (event: KeyboardEvent) => void];

function shouldFireEvent(event: KeyboardEvent) {
  if (event.target instanceof HTMLElement) {
    return !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
  }
  return true;
}

export function useHotkeys(hotkeys: HotkeyItem[]) {
  useEffect(() => {
    const keydownListener = (event: KeyboardEvent) => {
      hotkeys.forEach(([hotkey, handler]) => {
        if (getHotkeyMatcher(hotkey)(event) && shouldFireEvent(event)) {
          handler(event);
        }
      });
    };

    document.documentElement.addEventListener('keydown', keydownListener);
    return () => document.documentElement.removeEventListener('keydown', keydownListener);
  }, [hotkeys]);
}
