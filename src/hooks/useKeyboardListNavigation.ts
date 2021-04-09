import { RefObject } from 'react';
import { useState, useCallback, useEffect } from '../lib/teact/teact';

export default (
  elementRef: RefObject<HTMLElement>,
  isOpen: boolean,
  onSelectWithEnter?: () => void,
) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<any>) => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    if (e.keyCode === 13 && onSelectWithEnter) {
      onSelectWithEnter();
      return;
    }

    if (e.keyCode !== 38 && e.keyCode !== 40) {
      return;
    }

    const focusedElement = document.activeElement;
    const elementChildren = Array.from(element.children);

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
  }, [focusedIndex, elementRef, onSelectWithEnter]);

  return handleKeyDown;
};
