import { useEffect, useRef, useState } from '../../../../lib/teact/teact';

import captureKeyboardListeners from '../../../../util/captureKeyboardListeners';
import cycleRestrict from '../../../../util/cycleRestrict';

import useLastCallback from '../../../../hooks/useLastCallback';

export function useKeyboardNavigation({
  isActive,
  isHorizontal,
  shouldSaveSelectionOnUpdateItems,
  shouldRemoveSelectionOnReset,
  noArrowNavigation,
  items,
  shouldSelectOnTab,
  onSelect,
  onClose,
}: {
  isActive: boolean;
  isHorizontal?: boolean;
  shouldSaveSelectionOnUpdateItems?: boolean;
  shouldRemoveSelectionOnReset?: boolean;
  noArrowNavigation?: boolean;
  items?: any[];
  shouldSelectOnTab?: boolean;
  onSelect: (item: any) => void | boolean;
  onClose: NoneToVoidFunction;
}) {
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const prevItemsSignatureRef = useRef<string | undefined>();

  const getSelectedIndex = useLastCallback((newIndex: number) => {
    if (!items) {
      return -1;
    }

    return cycleRestrict(items.length, newIndex);
  });

  const handleArrowKey = useLastCallback((value: number, e: KeyboardEvent) => {
    e.preventDefault();
    setSelectedItemIndex((index) => (getSelectedIndex(index + value)));
  });

  const handleHorizontalArrowLeft = useLastCallback((e: KeyboardEvent) => {
    if (!items?.length) {
      return;
    }

    e.preventDefault();

    setSelectedItemIndex((index) => {
      if (index === -1) {
        onClose();
        return -1;
      }

      if (index === 0) {
        return -1;
      }

      return index - 1;
    });
  });

  const handleHorizontalArrowRight = useLastCallback((e: KeyboardEvent) => {
    if (!items?.length) {
      return;
    }

    e.preventDefault();
    setSelectedItemIndex((index) => {
      if (index === -1) {
        return 0;
      }

      return cycleRestrict(items.length, index + 1);
    });
  });

  const handleItemSelect = useLastCallback((e: KeyboardEvent) => {
    // Prevent action on key combinations
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
    if (!isActive) return false;

    if (items && items.length && selectedItemIndex > -1) {
      const item = items[selectedItemIndex];
      if (item) {
        if (onSelect(item) === false) {
          return false;
        }

        e.preventDefault();
      }
    }

    return true;
  });

  useEffect(() => {
    if (!isActive) setSelectedItemIndex(shouldRemoveSelectionOnReset ? -1 : 0);
  }, [isActive, shouldRemoveSelectionOnReset]);

  const isSelectionOutOfRange = !items || selectedItemIndex > items.length - 1;
  const itemsSignature = items?.map((item, index) => {
    if (item && typeof item === 'object' && 'id' in item) {
      return String((item as { id: unknown }).id);
    }

    return String(item ?? index);
  }).join('\x01') || '';

  useEffect(() => {
    const hasItemsChanged = prevItemsSignatureRef.current !== undefined
      && prevItemsSignatureRef.current !== itemsSignature;
    prevItemsSignatureRef.current = itemsSignature;

    if (
      (!shouldSaveSelectionOnUpdateItems && hasItemsChanged)
      || isSelectionOutOfRange
    ) {
      setSelectedItemIndex(shouldRemoveSelectionOnReset ? -1 : 0);
    }
  }, [itemsSignature, isSelectionOutOfRange, shouldRemoveSelectionOnReset, shouldSaveSelectionOnUpdateItems]);

  useEffect(() => (isActive ? captureKeyboardListeners({
    onEsc: onClose,
    onUp: noArrowNavigation
      ? undefined
      : (isHorizontal ? handleHorizontalArrowLeft : (e: KeyboardEvent) => handleArrowKey(-1, e)),
    onDown: noArrowNavigation
      ? undefined
      : (isHorizontal ? handleHorizontalArrowRight : (e: KeyboardEvent) => handleArrowKey(1, e)),
    onLeft: noArrowNavigation || !isHorizontal ? undefined : handleHorizontalArrowLeft,
    onRight: noArrowNavigation || !isHorizontal ? undefined : handleHorizontalArrowRight,
    onTab: shouldSelectOnTab ? handleItemSelect : undefined,
    onEnter: handleItemSelect,
  }) : undefined), [
    noArrowNavigation,
    handleArrowKey,
    handleHorizontalArrowLeft,
    handleHorizontalArrowRight,
    handleItemSelect,
    isActive,
    isHorizontal,
    onClose,
    shouldSelectOnTab,
  ]);

  return selectedItemIndex;
}
