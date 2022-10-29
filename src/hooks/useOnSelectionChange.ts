import { useEffect } from '../lib/teact/teact';

export default function useOnSelectionChange(container: HTMLElement | null, callback: (range: Range) => void) {
  useEffect(() => {
    if (!container) return undefined;

    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection) return;

      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        const ancestor = range.commonAncestorContainer;
        if (container.contains(ancestor)) {
          callback(range);
        }
      }
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [callback, container]);
}
