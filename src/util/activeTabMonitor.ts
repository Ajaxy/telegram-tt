const STORAGE_KEY = 'tt-active-tab';
const INTERVAL = 2000;

const tabKey = String(Date.now() + Math.random());

localStorage.setItem(STORAGE_KEY, tabKey);

let callback: NoneToVoidFunction;

const interval = window.setInterval(() => {
  if (callback && localStorage.getItem(STORAGE_KEY) !== tabKey) {
    callback();
    clearInterval(interval);
  }
}, INTERVAL);

export function addActiveTabChangeListener(_callback: NoneToVoidFunction) {
  callback = _callback;
}
