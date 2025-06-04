import { useEffect, useState } from '../lib/teact/teact';

function useAsync<T>(fn: () => Promise<T>, deps: unknown[], defaultValue: T): {
  isLoading: boolean;
  error: Error | undefined;
  result: T;
};
function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): {
  isLoading: boolean;
  error: Error | undefined;
  result: T | undefined;
};
function useAsync<T>(fn: () => Promise<T>, deps: unknown[], defaultValue?: T) {
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
