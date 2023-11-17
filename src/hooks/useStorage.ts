import { useEffect, useState } from '../lib/teact/teact';

export function useStorage() {
  const [isArchiverEnabled, setIsArchiverEnabled] = useLocalStorage<boolean>('ulu_is_autoarchiver_enabled', false);

  return {
    isArchiverEnabled, setIsArchiverEnabled,
  };
}

function useLocalStorage<T>(key: string, initValue: T): [value: T, setValue: (val: T) => void] {
  const eventName = `update_storage_${key}`;

  const [state, setState] = useState<T>((() => {
    const value = localStorage.getItem(key);
    // eslint-disable-next-line no-null/no-null
    if (value !== null) {
      return JSON.parse(value);
    }

    localStorage.setItem(key, JSON.stringify(initValue));
    window.dispatchEvent(new Event(eventName));
    return initValue;
  })());

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
    window.dispatchEvent(new Event(eventName));
  }, [key, state, eventName]);

  useEffect(() => {
    const listenStorageChange = () => {
      setState(() => {
        const value = localStorage.getItem(key);
        // eslint-disable-next-line no-null/no-null
        if (value !== null) {
          return JSON.parse(value);
        }

        localStorage.setItem(key, JSON.stringify(initValue));
        window.dispatchEvent(new Event(eventName));
        return initValue;
      });
    };
    window.addEventListener(eventName, listenStorageChange);
    return () => window.removeEventListener(eventName, listenStorageChange);
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, []);

  return [state, setState];
}
