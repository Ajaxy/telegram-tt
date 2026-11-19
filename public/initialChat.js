// Lets the skeleton snapshot draw the right column, which comes back only with a chat opened from the URL,
// see `parseLocationHash` in `src/util/routing.ts`
if (/^#-?\d+(?:[_?]|$)/.test(window.location.hash)) {
  document.documentElement.classList.add('with-initial-chat');
}
