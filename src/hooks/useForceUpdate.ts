import { useCallback, useState } from '../lib/teact/teact';

export default () => {
  const [, setTrigger] = useState<boolean>(false);

  return useCallback(() => {
    setTrigger((trigger) => !trigger);
  }, []);
};
