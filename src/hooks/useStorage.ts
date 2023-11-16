import { useState } from '../lib/teact/teact';

export function useStorage() {
  const [isArchiverEnabled, setStateIsArchiverEnabled] = useState(
    !!JSON.parse(String(localStorage.getItem('ulu_is_autoarchiver_enabled'))),
  );

  const setIsArchiverEnabled = (value: boolean) => {
    localStorage.setItem('ulu_is_autoarchiver_enabled', JSON.stringify(value));
    setStateIsArchiverEnabled(value);
  };

  return { isArchiverEnabled, setIsArchiverEnabled };
}
