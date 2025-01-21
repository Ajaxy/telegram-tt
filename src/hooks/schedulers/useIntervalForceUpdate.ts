import useForceUpdate from '../useForceUpdate';
import useInterval from './useInterval';

export default function useIntervalForceUpdate(interval?: number) {
  const forceUpdate = useForceUpdate();

  useInterval(forceUpdate, interval, true);
}
