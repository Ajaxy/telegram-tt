import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import { createSignal } from '../../../util/signals';

import useDerivedSignal from '../../../hooks/useDerivedSignal';

const [getControlsVisible, setControlsVisibleSignal] = createSignal(false);
const [getIsLocked, setIsLocked] = createSignal(false);

let playerElement: HTMLElement | undefined;
let controlsElement: HTMLElement | undefined;
let getMousePosition: (() => { x: number; y: number } | undefined) | undefined;

function isPositionInsideElement(position: { x: number; y: number }, element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  return position.x >= bounds.left && position.x <= bounds.right
    && position.y >= bounds.top && position.y <= bounds.bottom;
}

export function isMouseInsideControls() {
  if (IS_TOUCH_ENV) return false;
  if (!controlsElement || !getMousePosition) return false;
  const position = getMousePosition();
  if (!position) return false;
  return isPositionInsideElement(position, controlsElement);
}

function isMouseInsidePlayer() {
  if (IS_TOUCH_ENV) return true;
  if (!playerElement || !getMousePosition) return false;
  const position = getMousePosition();
  if (!position) return true;
  return isPositionInsideElement(position, playerElement) || isMouseInsideControls();
}

const setControlsVisible = (value: boolean, noPositionCheck?: boolean) => {
  if (value && (!noPositionCheck && !isMouseInsidePlayer())) return;
  setControlsVisibleSignal(value);
};

export function registerPlayerElement(
  element: HTMLElement | undefined,
  mousePositionGetter?: () => { x: number; y: number } | undefined,
) {
  playerElement = element;
  getMousePosition = mousePositionGetter;
}

export function registerControlsElement(element: HTMLElement | undefined) {
  controlsElement = element;
}

export default function useControlsSignal() {
  const getVisible = useDerivedSignal(
    () => getControlsVisible() && !getIsLocked(),
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
    [getControlsVisible, getIsLocked],
  );

  return [getVisible, setControlsVisible, setIsLocked] as const;
}
