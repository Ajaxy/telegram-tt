import type { GlobalState } from '../../global/types';

import useDerivedState from '../useDerivedState';
import useSelectorSignal from './useSelectorSignal';

type Selector<T> = (global: GlobalState) => T;

export default function useSelector<T>(selector: Selector<T>) {
  const selectorSignal = useSelectorSignal(selector);
  return useDerivedState(selectorSignal);
}
