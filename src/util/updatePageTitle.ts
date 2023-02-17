import { debounce } from './schedulers';

const UPDATE_DEBOUNCE_MS = 200;

// For some reason setting `document.title` to the same value
// causes increment of Chrome Dev Tools > Performance Monitor > DOM Nodes counter
function updatePageTitle(nextTitle: string) {
  if (document.title !== nextTitle) {
    document.title = nextTitle;
  }
}

// Synchronous page title update has conflicts with History API in Chrome
export default debounce(updatePageTitle, UPDATE_DEBOUNCE_MS, false);
