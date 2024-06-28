import { type Context, useContextSignal } from '../../lib/teact/teact';

import useDerivedState from '../useDerivedState';

export default function useContext<T>(context: Context<T>) {
  const signal = useContextSignal(context);
  return useDerivedState(signal);
}
