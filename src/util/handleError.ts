import { DEBUG, DEBUG_ALERT_MSG, IS_BYPASS_AUTH } from "../config";
import { isCurrentTabMaster } from "./establishMultitabRole";
import { throttle } from "./schedulers";

let showError = true;
let error: Error | undefined;

window.addEventListener("error", handleErrorEvent);
window.addEventListener("unhandledrejection", handleErrorEvent);

if (DEBUG) {
  window.addEventListener("focus", () => {
    if (!isCurrentTabMaster()) {
      return;
    }
    showError = true;
    if (error) {
      window.alert(getErrorMessage(error));
      error = undefined;
    }
  });
  window.addEventListener("blur", () => {
    if (!isCurrentTabMaster()) {
      return;
    }
    showError = false;
  });
}

const throttleError = throttle((err) => {
  if (showError) {
    window.alert(getErrorMessage(err));
  } else {
    error = err;
  }
}, 1500);

export function handleError(err: Error) {
  // Suppress errors in bypass auth mode (except for console logging)
  if (IS_BYPASS_AUTH) {
    // eslint-disable-next-line no-console
    console.log(">>> SUPPRESSING ERROR - BYPASS AUTH MODE:", err);
    return;
  }

  // eslint-disable-next-line no-console
  console.error(err);
  if (DEBUG) {
    throttleError(err);
  }
}

function handleErrorEvent(e: ErrorEvent | PromiseRejectionEvent) {
  // https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
  if (
    e instanceof ErrorEvent &&
    e.message === "ResizeObserver loop limit exceeded"
  ) {
    return;
  }

  e.preventDefault();
  handleError(e instanceof ErrorEvent ? e.error || e.message : e.reason);
}

function getErrorMessage(err: Error) {
  return `${DEBUG_ALERT_MSG}\n\n${err?.message || err}\n${err?.stack}`;
}
