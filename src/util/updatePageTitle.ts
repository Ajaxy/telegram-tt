import { IS_TAURI } from './browser/globalEnvironment';
import { debounce } from './schedulers';

const UPDATE_DEBOUNCE_MS = 200;

// For some reason setting `document.title` to the same value
// causes increment of Chrome Dev Tools > Performance Monitor > DOM Nodes counter
export async function setPageTitleInstant(nextTitle: string) {
  if (IS_TAURI) {
    await window.tauri?.setWindowTitle(nextTitle);

    return;
  }

  if (document.title !== nextTitle) {
    document.title = nextTitle;
  }
}

// Synchronous page title update has conflicts with History API in Chrome
export const setPageTitle = debounce(setPageTitleInstant, UPDATE_DEBOUNCE_MS, false);
