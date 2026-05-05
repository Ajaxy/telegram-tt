import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import { createSignal } from '../../../util/signals';

import useDerivedSignal from '../../../hooks/useDerivedSignal';

const [getControlsVisible, setControlsVisibleSignal] = createSignal(false);
const [getIsLocked, setIsLocked] = createSignal(false);

let playerElement: HTMLElement | undefined;
let getMousePosition: (() => { x: number; y: number } | undefined) | undefined;

function isMouseInsidePlayer() {
  if (IS_TOUCH_ENV) return true;
  if (!playerElement || !getMousePosition) return false;
  const pos = getMousePosition();
  if (!pos) return true;
  const bounds = playerElement.getBoundingClientRect();
  return pos.x >= bounds.left && pos.x <= bounds.right
    && pos.y >= bounds.top && pos.y <= bounds.bottom;
}

const setControlsVisible = (value: boolean, noPositionCheck?: boolean) => {
  if (value && (!noPositionCheck && !isMouseInsidePlayer())) return;
  setControlsVisibleSignal(value);
};

export function registerPlayerElement(
  el: HTMLElement | undefined,
  mousePositionGetter?: () => { x: number; y: number } | undefined,
) {
  playerElement = el;
  getMousePosition = mousePositionGetter;
}

export default function useControlsSignal() {
  const getVisible = useDerivedSignal(
    () => getControlsVisible() && !getIsLocked(),
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
    [getControlsVisible, getIsLocked],
  );

  return [getVisible, setControlsVisible, setIsLocked] as const;
}
