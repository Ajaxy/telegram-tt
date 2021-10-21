import { useRef } from '../lib/teact/teact';
import generateIdFor from '../util/generateIdFor';

const store: Record<string, boolean> = {};

export default () => {
  const idRef = useRef<string>();

  if (!idRef.current) {
    idRef.current = generateIdFor(store);
    store[idRef.current] = true;
  }

  return idRef.current;
};
