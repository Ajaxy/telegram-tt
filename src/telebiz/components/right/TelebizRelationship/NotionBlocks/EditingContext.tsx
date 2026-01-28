import { createContext } from '../../../../../lib/teact/teact';

import useContext from '../../../../../hooks/data/useContext';

interface EditingContextValue {
  editingBlockId?: string;
  setEditingBlockId: (blockId?: string) => void;
}

export const EditingContext = createContext<EditingContextValue>();

export function useEditingContext(): EditingContextValue {
  const context = useContext(EditingContext);
  if (!context) {
    throw new Error('useEditingContext must be used within EditingProvider');
  }
  return context;
}
