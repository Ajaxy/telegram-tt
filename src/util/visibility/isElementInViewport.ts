import windowSize from '../windowSize';

export function isElementInViewport(el: HTMLElement) {
  if (el.style.display === 'none') {
    return false;
  }

  const rect = el.getBoundingClientRect();
  const { height: windowHeight } = windowSize.get();

  return (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
}
