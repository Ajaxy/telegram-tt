import { useCallback, useState } from 'react';

const useForceUpdate = () => {
  const [, setTrigger] = useState<boolean>(false);

  return useCallback(() => {
    setTrigger((trigger) => !trigger);
  }, []);
};

export default useForceUpdate;
