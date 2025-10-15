import { debounce } from './schedulers.ts';

const DRAG_ENTER_DEBOUNCE = 50; // Workaround for `dragenter` firing before previous `dragleave`
const DRAG_ENTER_ACTION_DELAY = 500;

let willSkipNext = false;
let timeout: number | undefined;

export const onDragEnter = debounce((cb: NoneToVoidFunction, shouldSkipNext = false) => {
  if (timeout) {
    clearTimeout(timeout);
    timeout = undefined;
  }

  if (willSkipNext) {
    willSkipNext = false;
    return;
  }

  timeout = window.setTimeout(() => {
    if (shouldSkipNext) {
      willSkipNext = true;
    }

    cb();
  }, DRAG_ENTER_ACTION_DELAY);
}, DRAG_ENTER_DEBOUNCE, false);

export function onDragLeave() {
  if (timeout) {
    clearTimeout(timeout);
    timeout = undefined;
  }
}
