import { useState, useCallback, useRef } from '../lib/teact/teact';

export type ReducerAction<Actions> = { type: Actions; payload?: any };
export type StateReducer<State, Actions> = (state: State, action: ReducerAction<Actions>) => State;
export type Dispatch<Actions> = (action: ReducerAction<Actions>) => void;

export default function useReducer<State, Actions>(
  reducer: StateReducer<State, Actions>,
  initialState: State,
) {
  const reducerRef = useRef(reducer);
  const [state, setState] = useState<State>(initialState);

  const dispatch = useCallback((action: ReducerAction<Actions>) => {
    setState((currentState) => reducerRef.current(currentState, action));
  }, []);

  return [
    state,
    dispatch,
  ] as [State, Dispatch<Actions>];
}
