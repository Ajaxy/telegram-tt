import { DEBUG_ALERT_MSG, GLOBAL_STATE_CACHE_KEY } from '../config';
import { throttle } from './schedulers';

window.addEventListener('error', handleErrorEvent);
window.addEventListener('unhandledrejection', handleErrorEvent);

// eslint-disable-next-line prefer-destructuring
const APP_ENV = process.env.APP_ENV;
const STARTUP_TIMEOUT = 5000;

const startedAt = Date.now();
let isReloading = false;

function handleErrorEvent(e: ErrorEvent | PromiseRejectionEvent) {
  e.preventDefault();

  handleError(e instanceof ErrorEvent ? e.error : e.reason);
}

const throttledAlert = throttle(window.alert, 1000);

export function handleError(err: Error) {
  // eslint-disable-next-line no-console
  console.error(err);

  if (isReloading) {
    return;
  }

  // For startup errors, we just clean the cache and refresh the page
  if (Date.now() - startedAt <= STARTUP_TIMEOUT && localStorage.getItem(GLOBAL_STATE_CACHE_KEY)) {
    localStorage.removeItem(GLOBAL_STATE_CACHE_KEY);

    isReloading = true;
    window.location.reload();

    return;
  }

  if (APP_ENV === 'development' || APP_ENV === 'staging') {
    throttledAlert(`${DEBUG_ALERT_MSG}\n\n${(err && err.message) || err}\n${err && err.stack}`);
  }
}
