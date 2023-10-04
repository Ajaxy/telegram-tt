import type { BrowserWindow, Rectangle } from 'electron';
import { screen } from 'electron';

import { store } from './utils';

type Options = {
  defaultHeight?: number;
  defaultWidth?: number;
  fullScreen?: boolean;
  maximize?: boolean;
};

type State = {
  displayBounds: {
    height: number;
    width: number;
  };
  width: number;
  height: number;
  x: number;
  y: number;
  isFullScreen: boolean;
  isMaximized: boolean;
  urlHash: string;
};

export type WindowState = State & {
  manage: (window: Electron.BrowserWindow) => void;
  unmanage: () => void;
  resetStateToDefault: () => void;
  saveLastUrlHash: () => void;
  clearLastUrlHash: () => void;
};

const EVENT_HANDLING_DELAY = 100;
const STORE_KEY = 'window-state';
const DEFAULT_OPTIONS = {
  defaultHeight: 600,
  defaultWidth: 800,
  maximize: true,
  fullScreen: true,
};

function windowStateKeeper(options: Options): WindowState {
  let state: State;
  let winRef: BrowserWindow | undefined;
  let stateChangeTimer: ReturnType<typeof setTimeout>;

  options = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  function isNormal(win: BrowserWindow): boolean {
    return !win.isMaximized() && !win.isMinimized() && !win.isFullScreen();
  }

  function hasBounds(): boolean {
    return state
      && Number.isInteger(state.x)
      && Number.isInteger(state.y)
      && Number.isInteger(state.width) && state.width > 0
      && Number.isInteger(state.height) && state.height > 0;
  }

  function resetStateToDefault() {
    const displayBounds = screen.getPrimaryDisplay().bounds;

    state = {
      width: options.defaultWidth!,
      height: options.defaultHeight!,
      x: 0,
      y: 0,
      displayBounds,
      isMaximized: false,
      isFullScreen: false,
      urlHash: '',
    };
  }

  function windowWithinBounds(bounds: Rectangle) {
    return state.x >= bounds.x
      && state.y >= bounds.y
      && state.x + state.width <= bounds.x + bounds.width
      && state.y + state.height <= bounds.y + bounds.height;
  }

  function ensureWindowVisibleOnSomeDisplay() {
    const visible = screen.getAllDisplays().some((display) => windowWithinBounds(display.bounds));

    if (!visible) {
      resetStateToDefault();
    }
  }

  function validateState() {
    const isValid = state && (hasBounds() || state.isMaximized || state.isFullScreen);

    if (!isValid) {
      resetStateToDefault();
      return;
    }

    if (hasBounds() && state.displayBounds) {
      ensureWindowVisibleOnSomeDisplay();
    }
  }

  function updateState() {
    if (!winRef) {
      return;
    }

    // Don't throw an error when window was closed
    try {
      const winBounds = winRef.getBounds();
      if (isNormal(winRef)) {
        state.x = winBounds.x;
        state.y = winBounds.y;
        state.width = winBounds.width;
        state.height = winBounds.height;
      }
      state.isMaximized = winRef.isMaximized();
      state.isFullScreen = winRef.isFullScreen();
      state.displayBounds = screen.getDisplayMatching(winBounds).bounds;
    } catch (err) {
      // Handler not supported, ignoring
    }
  }

  function handleStateChange() {
    clearTimeout(stateChangeTimer);
    stateChangeTimer = setTimeout(updateState, EVENT_HANDLING_DELAY);
  }

  function handleClose() {
    updateState();
  }

  function handleClosed() {
    unmanage();
    store.set(STORE_KEY, state);
  }

  function manage(win: BrowserWindow) {
    if (options.maximize && state.isMaximized) {
      win.maximize();
    }
    if (options.fullScreen && state.isFullScreen) {
      win.setFullScreen(true);
    }
    win.on('resize', handleStateChange);
    win.on('move', handleStateChange);
    win.on('close', handleClose);
    win.on('closed', handleClosed);
    winRef = win;
  }

  function unmanage() {
    if (winRef) {
      winRef.removeListener('resize', handleStateChange);
      winRef.removeListener('move', handleStateChange);
      clearTimeout(stateChangeTimer);
      winRef.removeListener('close', handleClose);
      winRef.removeListener('closed', handleClosed);
      winRef = undefined;
    }
  }

  function saveLastUrlHash() {
    if (winRef) {
      const { hash } = new URL(winRef.webContents.getURL());

      state.urlHash = hash;
    }
  }

  function clearLastUrlHash() {
    state.urlHash = '';
  }

  state = store.get(STORE_KEY) as State;

  validateState();

  return {
    get x() { return state.x; },
    get y() { return state.y; },
    get width() { return state.width; },
    get height() { return state.height; },
    get displayBounds() { return state.displayBounds; },
    get isMaximized() { return state.isMaximized; },
    get isFullScreen() { return state.isFullScreen; },
    get urlHash() { return state.urlHash || ''; },
    unmanage,
    manage,
    resetStateToDefault,
    saveLastUrlHash,
    clearLastUrlHash,
  };
}

export default windowStateKeeper;
