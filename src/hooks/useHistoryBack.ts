// This is unsafe and can be not chained as `popstate` event is asynchronous

export default function useHistoryBack(handler: NoneToVoidFunction) {
  function handlePopState() {
    handler();
  }

  window.addEventListener('popstate', handlePopState);
  window.history.pushState({}, '');

  return () => {
    window.removeEventListener('popstate', handlePopState);
    window.history.back();
  };
}
