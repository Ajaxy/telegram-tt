import { createContext } from '../lib/teact/teact';

import useContext from './data/useContext';

export const WindowContext = createContext<Window | undefined>(undefined);

export default function useWindow() {
  return useContext(WindowContext) || window;
}
