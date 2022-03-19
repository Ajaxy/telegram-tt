import { typify } from '../lib/teact/teactn';
import { GlobalState, ActionPayloads, NonTypedActionNames } from '../global/types';

const typed = typify<GlobalState, ActionPayloads, NonTypedActionNames>();

export const getGlobal = typed.getGlobal;
export const setGlobal = typed.setGlobal;
export const getDispatch = typed.getDispatch;
export const addReducer = typed.addReducer;
export const withGlobal = typed.withGlobal;
