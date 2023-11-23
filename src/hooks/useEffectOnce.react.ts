import { useEffect } from 'react';

function useEffectOnce(effect: React.EffectCallback) {
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  useEffect(effect, []);
}

export default useEffectOnce;
