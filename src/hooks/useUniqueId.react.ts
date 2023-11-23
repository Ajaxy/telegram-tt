import { useRef } from 'react';

import generateUniqueId from '../util/generateUniqueId';

// TODO this probably could be replaced w/ React.useId
export default function useUniqueId() {
  const idRef = useRef<string>();

  if (!idRef.current) {
    idRef.current = generateUniqueId();
  }

  return idRef.current;
}
