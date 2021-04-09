import { useCallback, useState } from '../lib/teact/teact';

export default () => {
  const [cacheBuster, setCacheBuster] = useState<boolean>(false);

  const updateCacheBuster = useCallback(() => {
    setCacheBuster((current) => !current);
  }, []);

  return [cacheBuster, updateCacheBuster] as const;
};
