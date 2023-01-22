import { useEffect } from '../lib/teact/teact';

export default function useOnSelectionChange(
  inputSelector: string, callback: (range: Range) => void,
) {
  useEffect(() => {
    function onSelectionChange() {
      const selection = window.getSelection();
      if (!selection) return;

      const inputEl = document.querySelector(inputSelector);
      if (!inputEl) {
        return;
      }

      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        const ancestor = range.commonAncestorContainer;
        if (inputEl.contains(ancestor)) {
          callback(range);
        }
      }
    }

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [callback, inputSelector]);
}
