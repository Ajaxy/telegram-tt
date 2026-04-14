import { useCallback, useState } from '../lib/teact/teact';

const useForceUpdate = () => {
  // eslint-disable-next-line @eslint-react/use-state
  const [_, setTrigger] = useState<boolean>(false);

  return useCallback(() => {
    setTrigger((trigger) => !trigger);
  }, []);
};

export default useForceUpdate;
