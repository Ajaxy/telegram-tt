import { useRef } from '../lib/teact/teact';

import useLastCallback from './useLastCallback';

type UseClickableOptions = {
  disabled?: boolean;
  role?: React.AriaRole;
  withA11y?: boolean;
  tabIndex?: number;
};

type ClickableProps<T extends HTMLElement> = Partial<Pick<
  React.HTMLAttributes<T>,
  'onClick' | 'onKeyDown' | 'onKeyUp' | 'role' | 'tabIndex' | 'aria-disabled'
>>;

// WAI-ARIA keyboard activation patterns per role
const ROLES_WITH_ENTER_ACTIVATION = new Set<React.AriaRole>([
  'button', 'link', 'menuitem', 'switch', 'tab', 'treeitem',
]);

const ROLES_WITH_SPACE_ACTIVATION = new Set<React.AriaRole>([
  'button', 'switch', 'checkbox', 'radio', 'option', 'tab', 'treeitem',
]);

export default function useClickable<T extends HTMLElement>(
  onPress?: (e: React.MouseEvent<T>) => void,
  {
    disabled,
    role = 'button',
    withA11y = true,
    tabIndex = 0,
  }: UseClickableOptions = {},
): ClickableProps<T> {
  const shouldHandleSyntheticClickRef = useRef(false);
  const withListeners = Boolean(onPress) && !disabled;

  const handlePress = useLastCallback((e: React.MouseEvent<T>) => {
    const nativeEvent = e.nativeEvent as (MouseEvent & { pointerId?: number }) | undefined;
    const isSyntheticClick = e.detail === 0 || nativeEvent?.pointerId === -1; // Some mouse clicks produce two events

    if (isSyntheticClick && !shouldHandleSyntheticClickRef.current) return;

    shouldHandleSyntheticClickRef.current = false;
    onPress?.(e);
  });

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent<T>) => {
    if (e.key === 'Enter' && ROLES_WITH_ENTER_ACTIVATION.has(role)) {
      e.preventDefault();
      shouldHandleSyntheticClickRef.current = true;
      e.currentTarget.click();
      return;
    }

    if (e.key === ' ' && ROLES_WITH_SPACE_ACTIVATION.has(role)) {
      e.preventDefault();
    }
  });

  const handleKeyUp = useLastCallback((e: React.KeyboardEvent<T>) => {
    if (e.key !== ' ' || !ROLES_WITH_SPACE_ACTIVATION.has(role)) return;

    e.preventDefault();
    shouldHandleSyntheticClickRef.current = true;
    e.currentTarget.click();
  });

  return {
    onClick: withListeners ? handlePress : undefined,
    onKeyDown: withListeners ? handleKeyDown : undefined,
    onKeyUp: withListeners ? handleKeyUp : undefined,
    role: onPress && withA11y ? role : undefined,
    tabIndex: onPress && withA11y ? (disabled ? -1 : tabIndex) : undefined,
    'aria-disabled': onPress && withA11y && disabled ? true : undefined,
  };
}
