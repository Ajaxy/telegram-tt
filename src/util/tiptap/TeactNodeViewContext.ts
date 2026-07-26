import { createContext } from '../../lib/teact/teact';

import useContext from '../../hooks/data/useContext';

export type TeactNodeViewContextValue = {
  contentDOMElement?: HTMLElement;
};

export const TeactNodeViewContext = createContext<TeactNodeViewContextValue>({
  contentDOMElement: undefined,
});

export function useTeactNodeViewContext() {
  return useContext(TeactNodeViewContext);
}
