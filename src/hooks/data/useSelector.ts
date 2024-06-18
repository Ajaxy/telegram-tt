import type { GlobalState } from '../../global/types';

import useDerivedState from '../useDerivedState';
import useSelectorSignal from './useSelectorSignal';

type Selector<T extends unknown> = (global: GlobalState) => T;

export default function useSelector<T extends unknown>(selector: Selector<T>) {
  const selectorSignal = useSelectorSignal(selector);
  return useDerivedState(selectorSignal);
}
