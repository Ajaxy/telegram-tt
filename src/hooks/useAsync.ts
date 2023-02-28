import { useEffect, useState } from '../lib/teact/teact';

const useAsync = <T>(fn: () => Promise<T>, deps: any[], defaultValue?: T) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>();
  const [result, setResult] = useState<T | undefined>(defaultValue);
  useEffect(() => {
    setIsLoading(true);
    let wasCancelled = false;
    fn().then((res) => {
      if (wasCancelled) return;
      setIsLoading(false);
      setResult(res);
    }, (err) => {
      if (wasCancelled) return;
      setIsLoading(false);
      setError(err);
    });
    return () => {
      wasCancelled = true;
    };
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, deps);
  return { isLoading, error, result };
};

export default useAsync;
