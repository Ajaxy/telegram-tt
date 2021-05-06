import { throttle } from './schedulers';

type IDimensions = {
  width: number;
  height: number;
};

let windowSize = updateSizes();

export function updateSizes(): IDimensions {
  const vh = window.innerHeight * 0.01;

  document.documentElement.style.setProperty('--vh', `${vh}px`);

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

const handleResize = throttle(() => {
  windowSize = updateSizes();
}, 250, true);

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

export default {
  get: () => windowSize,
};
