import { useCallback, useRef } from '../lib/teact/teact';

import useForceUpdate from './useForceUpdate';

export type ReducerAction<Actions> = { type: Actions; payload?: any };
export type StateReducer<State, Actions> = (state: State, action: ReducerAction<Actions>) => State;
export type Dispatch<State, Actions> = (action: ReducerAction<Actions>) => State;

export default function useReducer<State, Actions>(
  reducer: StateReducer<State, Actions>,
  initialState: State,
) {
  const forceUpdate = useForceUpdate();
  const reducerRef = useRef(reducer);
  const stateRef = useRef(initialState);

  const dispatch = useCallback((action: ReducerAction<Actions>) => {
    stateRef.current = reducerRef.current(stateRef.current, action);
    forceUpdate();
    return stateRef.current;
  }, []);

  return [
    stateRef.current,
    dispatch,
  ] as [State, Dispatch<State, Actions>];
}
