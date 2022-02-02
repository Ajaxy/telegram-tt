import { useCallback, useState } from '../lib/teact/teact';

const useFlag = (initial = false): [boolean, AnyToVoidFunction, AnyToVoidFunction] => {
  const [value, setValue] = useState(initial);

  const setTrue = useCallback(() => {
    setValue(true);
  }, []);

  const setFalse = useCallback(() => {
    setValue(false);
  }, []);

  return [value, setTrue, setFalse];
};

export default useFlag;
