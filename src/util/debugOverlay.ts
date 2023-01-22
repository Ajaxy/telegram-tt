import { throttle } from './schedulers';

const KEYS_TO_IGNORE = new Set([
  'TeactMemoWrapper renders',
  'TeactNContainer renders',
  'Button renders',
]);
const MIN_RENDERS_TO_SHOW = 5;
const MIN_DURATION_TO_SHOW = 2;
const BG_GREEN = ' style="background: lightgreen"';

let counters: Record<string, {
  value: number;
  lastUpdateAt: number;
}> = {};

const renderCountersThrottled = throttle(renderCounters, 500, false);

let loggerEl: HTMLDivElement;

export function debugToOverlay(text: string) {
  if (!loggerEl) {
    setupOverlay();
  }

  const date = new Date();
  const dateFormatted = `${date.toLocaleTimeString()}.${date.getMilliseconds()}`;
  const wasAtBottom = loggerEl.scrollTop + 10 >= loggerEl.scrollHeight - loggerEl.offsetHeight;

  loggerEl.innerHTML += `${dateFormatted}: ${text}<br/>`;

  if (wasAtBottom) {
    loggerEl.scrollTop = loggerEl.scrollHeight;
  }
}

export function incrementOverlayCounter(key: string, value = 1) {
  const now = Date.now();
  if (!counters[key]) {
    counters[key] = { value, lastUpdateAt: now };
  } else {
    counters[key].value += value;
    counters[key].lastUpdateAt = now;
  }

  renderCountersThrottled();
}

export function renderCounters() {
  if (!loggerEl) {
    setupOverlay();
  }

  const halfSecondAgo = Date.now() - 500;
  const [maxRenders, maxDuration] = Object.entries(counters).reduce((acc, [key, { value }]) => {
    if (KEYS_TO_IGNORE.has(key)) {
      return acc;
    }

    if (key.includes('renders') && value > acc[0]) {
      acc[0] = value;
    }

    if (key.includes('duration') && value > acc[1]) {
      acc[1] = value;
    }

    return acc;
  }, [0, 0]);

  loggerEl.innerHTML = Object
    .entries(counters)
    .filter(([key, { value }]) => (
      (!KEYS_TO_IGNORE.has(key)) && (
        (key.includes('renders') && value > MIN_RENDERS_TO_SHOW)
        || (key.includes('duration') && value > MIN_DURATION_TO_SHOW)
      )
    ))
    .sort((a, b) => (
      b[1].lastUpdateAt - a[1].lastUpdateAt
    ))
    .map(([key, { value, lastUpdateAt }]) => ([
      `<div style="background: #ff0000${factorToHex(value / (key.includes('renders') ? maxRenders : maxDuration))}">`,
      `  <span${lastUpdateAt > halfSecondAgo ? BG_GREEN : ''}>${key}: ${Math.round(value)}</span>`,
      '</div>',
    ].join('\n')))
    .join('\n');
}

function setupOverlay() {
  loggerEl = document.createElement('div');
  loggerEl.style.cssText = 'position: absolute; left: 0; bottom: 25px; z-index: 9998; width: 260px; height: 200px;'
    + ' border: 1px solid #555; background: rgba(255, 255, 255, 0.9); overflow: auto; font-size: 10px;';
  document.body.appendChild(loggerEl);

  const clearEl = document.createElement('a');
  clearEl.style.cssText = 'position: absolute; left: 222px; bottom: 198px; z-index: 9999; font-size: 20px; '
    + 'cursor: pointer;';
  clearEl.innerText = '🔄';
  clearEl.addEventListener('click', () => {
    counters = {};
    renderCountersThrottled();
  });
  document.body.appendChild(clearEl);
}

function factorToHex(factor: number) {
  return Math.round(255 * factor).toString(16).padStart(2, '0');
}
