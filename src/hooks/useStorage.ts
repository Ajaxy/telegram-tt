import { useEffect, useState } from '../lib/teact/teact';

export function useStorage() {
  const [isArchiverEnabled, setIsArchiverEnabled] = useLocalStorage<boolean>('ulu_is_autoarchiver_enabled', false);

  return {
    isArchiverEnabled, setIsArchiverEnabled,
  };
}

const EVENT = 'ULU_UPDATE_STORAGE';

function useLocalStorage<T>(key: string, initValue: T): [value: T, setValue: (val: T) => void] {
  const [state, setState] = useState<T>((() => {
    const value = localStorage.getItem(key);
    // eslint-disable-next-line no-null/no-null
    if (value !== null && value !== undefined) {
      return JSON.parse(value);
    }

    localStorage.setItem(key, JSON.stringify(initValue));
    window.dispatchEvent(new Event(EVENT));
    return initValue;
  })());

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
    window.dispatchEvent(new Event(EVENT));
  }, [key, state]);

  useEffect(() => {
    const listenStorageChange = () => {
      setState(() => {
        const value = localStorage.getItem(key);
        // eslint-disable-next-line no-null/no-null
        if (value !== null && value !== undefined) {
          return JSON.parse(value);
        }

        localStorage.setItem(key, JSON.stringify(initValue));
        window.dispatchEvent(new Event(EVENT));
        return initValue;
      });
    };
    window.addEventListener(EVENT, listenStorageChange);
    return () => window.removeEventListener(EVENT, listenStorageChange);
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, []);

  return [state, setState];
}
