import { useCallback, useState } from '../lib/teact/teact';

const useForceUpdate = () => {
  const [, setTrigger] = useState<boolean>(false);

  return useCallback(() => {
    setTrigger((trigger) => !trigger);
  }, []);
};

export default useForceUpdate;
