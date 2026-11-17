import { getPressedKeys, isKeyPressed } from '../util/pressedKeys';
import useDerivedState from './useDerivedState';

export default function useIsKeyPressed(keyOrCode: string) {
  // Signal in deps is required to subscribe to its updates
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  return useDerivedState(() => isKeyPressed(keyOrCode), [getPressedKeys, keyOrCode]);
}
