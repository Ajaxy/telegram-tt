import { createSignal } from '../../../util/signals';

import useDerivedSignal from '../../../hooks/useDerivedSignal';

const [getControlsVisible, setControlsVisible] = createSignal(false);
const [getIsLocked, setIsLocked] = createSignal(false);

export default function useControlsSignal() {
  const getVisible = useDerivedSignal(
    () => getControlsVisible() && !getIsLocked(),
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
    [getControlsVisible, getIsLocked],
  );

  return [getVisible, setControlsVisible, setIsLocked] as const;
}
