import { useEffect, useState } from '../../lib/teact/teact';

export default function useBrowserOnline() {
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);

  useEffect(() => {
    function handleChange() {
      setIsOnline(window.navigator.onLine);
    }

    window.addEventListener('online', handleChange);
    window.addEventListener('offline', handleChange);

    return () => {
      window.removeEventListener('offline', handleChange);
      window.removeEventListener('online', handleChange);
    };
  }, []);

  return isOnline;
}
