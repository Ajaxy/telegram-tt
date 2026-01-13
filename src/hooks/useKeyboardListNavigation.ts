import type { ElementRef } from '../lib/teact/teact';
import { useEffect, useState } from '../lib/teact/teact';

import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import useLastCallback from './useLastCallback';

const useKeyboardListNavigation = (
  elementRef: ElementRef<HTMLElement>,
  isOpen: boolean,
  onSelectWithEnter?: (index: number) => void,
  itemSelector?: string,
  noCaptureFocus?: boolean,
) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    setFocusedIndex(-1);

    const element = elementRef.current;
    if (isOpen && element && !noCaptureFocus) {
      requestMutation(() => {
        element.tabIndex = -1;
      });
      requestMeasure(() => element.focus());
    }
  }, [elementRef, isOpen, noCaptureFocus]);

  return useLastCallback((e: React.KeyboardEvent<any>) => {
    const element = elementRef.current;

    if (!element || !isOpen) {
      return;
    }

    if (e.keyCode === 13 && onSelectWithEnter) {
      onSelectWithEnter(focusedIndex);
      return;
    }

    if (e.keyCode !== 38 && e.keyCode !== 40) {
      return;
    }

    const focusedElement = document.activeElement;
    const elementChildren = Array.from(itemSelector ? element.querySelectorAll(itemSelector) : element.children);

    let newIndex = (focusedElement && elementChildren.indexOf(focusedElement)) || focusedIndex;

    if (e.keyCode === 38 && newIndex > 0) {
      newIndex--;
    } else if (e.keyCode === 40 && newIndex < elementChildren.length - 1) {
      newIndex++;
    } else if (elementChildren.length === 1) {
      newIndex = 0;
    } else {
      return;
    }

    const item = elementChildren[newIndex] as HTMLElement;
    if (item) {
      setFocusedIndex(newIndex);
      item.focus();
    }
  });
};

export default useKeyboardListNavigation;
