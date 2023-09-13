import { useRef } from '../../../../lib/teact/teact';

import useForceUpdate from '../../../../hooks/useForceUpdate';
import usePrevious from '../../../../hooks/usePrevious';

export default function useLeftHeaderButtonRtlForumTransition(shouldHideSearch?: boolean) {
  const forceUpdate = useForceUpdate();
  const shouldDisableDropdownMenuTransitionRef = useRef(shouldHideSearch);
  const prevShouldHideSearch = usePrevious(shouldHideSearch);

  function handleDropdownMenuTransitionEnd() {
    shouldDisableDropdownMenuTransitionRef.current = Boolean(shouldHideSearch);
    forceUpdate();
  }

  if (shouldHideSearch === false && prevShouldHideSearch !== shouldHideSearch) {
    shouldDisableDropdownMenuTransitionRef.current = false;
  }

  return { shouldDisableDropdownMenuTransitionRef, handleDropdownMenuTransitionEnd };
}
