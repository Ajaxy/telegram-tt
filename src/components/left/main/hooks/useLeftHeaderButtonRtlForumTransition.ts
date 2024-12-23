import { useRef } from '../../../../lib/teact/teact';

import useForceUpdate from '../../../../hooks/useForceUpdate';
import usePreviousDeprecated from '../../../../hooks/usePreviousDeprecated';

export default function useLeftHeaderButtonRtlForumTransition(shouldHideSearch?: boolean) {
  const forceUpdate = useForceUpdate();
  const shouldDisableDropdownMenuTransitionRef = useRef(shouldHideSearch);
  const prevShouldHideSearch = usePreviousDeprecated(shouldHideSearch);

  function handleDropdownMenuTransitionEnd() {
    shouldDisableDropdownMenuTransitionRef.current = Boolean(shouldHideSearch);
    forceUpdate();
  }

  if (shouldHideSearch === false && prevShouldHideSearch !== shouldHideSearch) {
    shouldDisableDropdownMenuTransitionRef.current = false;
  }

  return { shouldDisableDropdownMenuTransitionRef, handleDropdownMenuTransitionEnd };
}
