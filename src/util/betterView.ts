import { animate } from './animation';
import { fastRaf } from './schedulers';
import { IS_IOS } from './windowEnvironment';

const TEST_INTERVAL = 5000; // 5 sec
const FRAMES_TO_TEST = 10;
const REDUCED_FPS = 35;

let isImproved = false;

export function betterView() {
  if (!IS_IOS) return;

  let interval: number | undefined;
  let lastFocusAt = Date.now();

  function setupInterval() {
    if (interval || isImproved) return;

    interval = window.setInterval(testAndImprove, TEST_INTERVAL);
  }

  window.addEventListener('focus', () => {
    const now = Date.now();
    if (now - lastFocusAt < 100) return; // iOS triggers two `focus` events for some reason
    lastFocusAt = now;

    setupInterval();
    testAndImprove();
  });

  window.addEventListener('blur', () => {
    clearInterval(interval);
    interval = undefined;
  });

  if (document.hasFocus()) {
    setupInterval();
    testAndImprove();
  }
}

async function testAndImprove() {
  const fps = await testFps();
  if (fps <= REDUCED_FPS) {
    improveView();
  }
}

function testFps() {
  return new Promise<number>((resolve) => {
    const frames: number[] = [];
    let lastFrameAt = performance.now();

    animate(() => {
      const now = performance.now();
      frames.push(now - lastFrameAt);
      lastFrameAt = now;

      if (frames.length === FRAMES_TO_TEST) {
        const mean = frames.sort()[Math.floor(frames.length / 2)];
        resolve(Math.round(1000 / mean));
        return false;
      }

      return true;
    }, fastRaf);
  });
}

function improveView() {
  isImproved = true;

  const containerEl = document.createElement('div');
  containerEl.style.cssText = 'position: absolute; top: 0; left: 0; width: 0; height: 100%; overflow: hidden;';

  const boosterEl = document.createElement('div');
  const height = window.screen.height * 1.5;
  boosterEl.style.cssText = `width: 0; height: ${height}px; transform: translateX(100%); transition: transform 100ms;`;
  boosterEl.innerHTML = '&nbsp;';

  containerEl.appendChild(boosterEl);
  document.body.appendChild(containerEl);

  requestAnimationFrame(() => {
    boosterEl.addEventListener('transitionend', () => {
      containerEl.remove();
    });

    boosterEl.style.transform = '';
  });
}
