import type { Dispatch, StateReducer } from '../useReducer';

import useReducer from '../useReducer';

export type TwoFaActions = (
  'setCurrentPassword' | 'setPassword' | 'setHint' | 'setEmail' | 'reset'
);
export type TwoFaDispatch = Dispatch<TwoFaState, TwoFaActions>;

export type TwoFaState = {
  currentPassword: string;
  password: string;
  hint: string;
  email: string;
};

const INITIAL_STATE: TwoFaState = {
  currentPassword: '',
  password: '',
  hint: '',
  email: '',
};

const twoFaReducer: StateReducer<TwoFaState, TwoFaActions> = (
  state,
  action,
) => {
  switch (action.type) {
    case 'setCurrentPassword':
      return {
        ...state,
        currentPassword: action.payload,
      };

    case 'setPassword':
      return {
        ...state,
        password: action.payload,
      };

    case 'setHint':
      return {
        ...state,
        hint: action.payload,
      };

    case 'setEmail':
      return {
        ...state,
        email: action.payload,
      };

    case 'reset':
      return INITIAL_STATE;

    default:
      return state;
  }
};

const useTwoFaReducer = () => {
  return useReducer(twoFaReducer, INITIAL_STATE);
};

export default useTwoFaReducer;
