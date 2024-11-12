import { useEffect, useSignal } from '../lib/teact/teact';

export default function useGetSelectionRange(inputSelector: string) {
  const [getRange, setRange] = useSignal<Range | undefined>();

  useEffect(() => {
    function onSelectionChange() {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;

      const range = selection.getRangeAt(0);
      if (!range) {
        return;
      }

      const inputEl = document.querySelector(inputSelector);
      if (!inputEl) {
        return;
      }

      const { commonAncestorContainer } = range;
      const element = commonAncestorContainer instanceof Element
        ? commonAncestorContainer
        : commonAncestorContainer.parentElement!;
      if (element.closest(inputSelector)) {
        setRange(range);
      }
    }

    document.addEventListener('selectionchange', onSelectionChange);

    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [inputSelector, setRange]);

  return getRange;
}
