import { useCallback, useState } from '../lib/teact/teact';

const useCacheBuster = () => {
  const [cacheBuster, setCacheBuster] = useState(0);

  const updateCacheBuster = useCallback(() => {
    setCacheBuster((current) => current + 1);
  }, []);

  return [cacheBuster, updateCacheBuster] as const;
};

export default useCacheBuster;
