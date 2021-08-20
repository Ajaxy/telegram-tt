import { useCallback, useEffect, useState } from '../../../../lib/teact/teact';
import captureKeyboardListeners from '../../../../util/captureKeyboardListeners';
import cycleRestrict from '../../../../util/cycleRestrict';

export function useKeyboardNavigation({
  isActive,
  isHorizontal,
  shouldRemoveSelectionOnReset,
  noArrowNavigation,
  items,
  shouldSelectOnTab,
  onSelect,
  onClose,
}: {
  isActive: boolean;
  isHorizontal?: boolean;
  shouldRemoveSelectionOnReset?: boolean;
  noArrowNavigation?: boolean;
  items?: any[];
  shouldSelectOnTab?: boolean;
  onSelect: AnyToVoidFunction;
  onClose: NoneToVoidFunction;
}) {
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);

  const getSelectedIndex = useCallback((newIndex: number) => {
    if (!items) {
      return -1;
    }

    return cycleRestrict(items.length, newIndex);
  }, [items]);

  const handleArrowKey = useCallback((value: number, e: KeyboardEvent) => {
    e.preventDefault();
    setSelectedItemIndex((index) => (getSelectedIndex(index + value)));
  }, [setSelectedItemIndex, getSelectedIndex]);

  const handleItemSelect = useCallback((e: KeyboardEvent) => {
    if (items && items.length && selectedItemIndex > -1) {
      const item = items[selectedItemIndex];
      if (item) {
        e.preventDefault();
        onSelect(item);
      }
    }
  }, [items, onSelect, selectedItemIndex]);

  useEffect(() => {
    setSelectedItemIndex(shouldRemoveSelectionOnReset ? -1 : 0);
  }, [items, shouldRemoveSelectionOnReset]);

  useEffect(() => (isActive ? captureKeyboardListeners({
    onEsc: onClose,
    onUp: noArrowNavigation || isHorizontal ? undefined : (e: KeyboardEvent) => handleArrowKey(-1, e),
    onDown: noArrowNavigation || isHorizontal ? undefined : (e: KeyboardEvent) => handleArrowKey(1, e),
    onLeft: noArrowNavigation || !isHorizontal ? undefined : (e: KeyboardEvent) => handleArrowKey(-1, e),
    onRight: noArrowNavigation || !isHorizontal ? undefined : (e: KeyboardEvent) => handleArrowKey(1, e),
    onTab: shouldSelectOnTab ? handleItemSelect : undefined,
    onEnter: handleItemSelect,
  }) : undefined), [
    noArrowNavigation, handleArrowKey, handleItemSelect, isActive, isHorizontal, onClose, shouldSelectOnTab,
  ]);

  return selectedItemIndex;
}
