import { useRef, useState } from '@teact';

import type { MediaEditDocument, MediaEditState } from '../../../../types/mediaEditor';

import useLastCallback from '../../../../hooks/useLastCallback';

type History = {
  past: MediaEditDocument[];
  present: MediaEditDocument;
  future: MediaEditDocument[];
  draft?: MediaEditDocument;
};

export default function useEditHistory(initialDocument: MediaEditDocument) {
  const [history, setHistory] = useState<History>({ past: [], present: initialDocument, future: [] });
  const historyRef = useRef(history);

  const updateHistory = (next: History) => {
    historyRef.current = next;
    setHistory(next);
  };

  const getDoc = useLastCallback(() => {
    const { draft, present } = historyRef.current;
    return draft || present;
  });

  const preview = useLastCallback((doc: MediaEditDocument) => {
    updateHistory({ ...historyRef.current, draft: doc });
  });

  const commit = useLastCallback((doc: MediaEditDocument) => {
    const { past, present } = historyRef.current;
    if (doc === present) return;

    updateHistory({ past: [...past, present], present: doc, future: [] });
  });

  const undo = useLastCallback(() => {
    const { past, present, future } = historyRef.current;
    if (!past.length) return;

    updateHistory({ past: past.slice(0, -1), present: past[past.length - 1], future: [...future, present] });
  });

  const redo = useLastCallback(() => {
    const { past, present, future } = historyRef.current;
    if (!future.length) return;

    updateHistory({ past: [...past, present], present: future[future.length - 1], future: future.slice(0, -1) });
  });

  const reset = useLastCallback((doc: MediaEditDocument) => {
    updateHistory({ past: [], present: doc, future: [] });
  });

  const restore = useLastCallback(({ document, undoStack, redoStack }: MediaEditState) => {
    updateHistory({ past: undoStack, present: document, future: redoStack });
  });

  const getEditState = useLastCallback((): MediaEditState => {
    const { past, present, future } = historyRef.current;
    return { document: present, undoStack: past, redoStack: future };
  });

  return {
    doc: history.draft || history.present,
    presentDoc: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    getDoc,
    preview,
    commit,
    undo,
    redo,
    reset,
    restore,
    getEditState,
  };
}
