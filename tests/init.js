import '@testing-library/jest-dom';

import { Buffer } from 'buffer/';
import { Crypto } from '@peculiar/webcrypto';

require('dotenv')
  .config();

localStorage.setItem('GramJs:sessionId', 'GramJs-session-TEST');
localStorage.setItem('GramJs-session-TEST', process.env.TEST_SESSION);

jest.mock('../src/api/gramjs/worker/provider');
jest.mock('../src/util/oggToWav');
jest.mock('../src/util/webpToPng');
jest.mock('../src/util/voiceRecording');
jest.mock('../src/lib/rlottie/RLottie');

Object.assign(global, {
  Buffer,
  crypto: new Crypto(),
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn()
    .mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
});

Object.defineProperty(global.Element.prototype, 'innerText', {
  get() {
    const el = this.cloneNode(true); // can skip if mutability isn't a concern
    el.querySelectorAll('script,style')
      .forEach((s) => s.remove());
    return el.textContent;
  },
  configurable: true, // make it so that it doesn't blow chunks on re-running tests with things like --watch
});

Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: class {
    observe() {
    }

    unobserve() {
    }

    disconnect() {
    }
  },
});
