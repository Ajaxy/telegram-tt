// This is unsafe and can be not chained as `popstate` event is asynchronous

import { useEffect } from '../lib/teact/teact';
import { IS_IOS } from '../util/environment';
import { HistoryWrapper } from '../util/history';

type HistoryBackFunction = ((event: PopStateEvent, noAnimation: boolean, previousHistoryState: any) => void);

// Carefully selected by swiping and observing visual changes
// TODO: may be different on other devices such as iPad, maybe take dpi into account?
const SAFARI_EDGE_BACK_GESTURE_LIMIT = 200;
const SAFARI_EDGE_BACK_GESTURE_DURATION = 200;
let isEdge = false;

const onTouchStart = (event: TouchEvent) => {
  const x = event.touches[0].pageX;

  // eslint-disable-next-line no-console
  console.log('starting touch from', x);

  if (x <= SAFARI_EDGE_BACK_GESTURE_LIMIT || x >= window.innerWidth - SAFARI_EDGE_BACK_GESTURE_LIMIT) {
    isEdge = true;
  }
};

const onTouchEnd = () => {
  if (isEdge) {
    // eslint-disable-next-line no-console
    console.log('touchend');
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log('setting isEdge to false');
      isEdge = false;
    }, SAFARI_EDGE_BACK_GESTURE_DURATION);
  }
};

if (IS_IOS) {
  // eslint-disable-next-line no-console
  console.log('Adding event listeners for useHistoryBack');
  window.addEventListener('touchstart', onTouchStart);
  window.addEventListener('touchend', onTouchEnd);
}

export default function useHistoryBack(handler: NoneToVoidFunction | HistoryBackFunction) {
  const onPopState = (event: PopStateEvent) => {
    // eslint-disable-next-line no-console
    console.log('onPopState, isEdge = ', isEdge, 'isHistoryChangedByUser = ', HistoryWrapper.isHistoryChangedByUser);
    // Check if the event was caused by History API call or the user
    if (!HistoryWrapper.isHistoryChangedByUser) {
      // HACK: Handle multiple event listeners.
      // onTickChange doesn't work on Safari for some reason
      setTimeout(() => {
        HistoryWrapper.isHistoryChangedByUser = true;
      }, 0);
      return;
    }
    handler(event, isEdge, HistoryWrapper.states[HistoryWrapper.states.length - 1]);
  };


  useEffect(() => {
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  });
}
