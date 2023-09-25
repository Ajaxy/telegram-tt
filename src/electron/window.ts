import type { HandlerDetails } from 'electron';
import {
  app, BrowserWindow, ipcMain, shell, systemPreferences,
} from 'electron';
import path from 'path';

import type { TrafficLightPosition } from '../types/electron';
import { ElectronAction, ElectronEvent } from '../types/electron';

import setupAutoUpdates from './autoUpdates';
import { processDeeplink } from './deeplink';
import tray from './tray';
import {
  forceQuit, getAppTitle, getCurrentWindow, getLastWindow, hasExtraWindows, IS_MAC_OS, IS_WINDOWS,
  TRAFFIC_LIGHT_POSITION, windows,
} from './utils';
import windowStateKeeper from './windowState';

const ALLOWED_DEVICE_ORIGINS = ['http://localhost:1234', 'file://'];

export function createWindow(url?: string) {
  const windowState = windowStateKeeper({
    defaultWidth: 1088,
    defaultHeight: 700,
  });

  let x;
  let y;

  const currentWindow = getCurrentWindow();
  if (currentWindow) {
    const [currentWindowX, currentWindowY] = currentWindow.getPosition();
    x = currentWindowX + 24;
    y = currentWindowY + 24;
  } else {
    x = windowState.x;
    y = windowState.y;
  }

  let width;
  let height;

  if (currentWindow) {
    const bounds = currentWindow.getBounds();

    width = bounds.width;
    height = bounds.height;
  } else {
    width = windowState.width;
    height = windowState.height;
  }

  const window = new BrowserWindow({
    show: false,
    x,
    y,
    minWidth: 360,
    width,
    height,
    title: getAppTitle(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: process.env.APP_ENV !== 'production',
    },
    ...(IS_MAC_OS && {
      titleBarStyle: 'hidden',
      trafficLightPosition: TRAFFIC_LIGHT_POSITION.standard,
    }),
  });

  window.on('page-title-updated', (event: Event) => {
    event.preventDefault();
  });

  windowState.manage(window);

  window.webContents.setWindowOpenHandler((details: HandlerDetails) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  window.webContents.session.setDevicePermissionHandler(({ deviceType, origin }) => {
    return deviceType === 'hid' && ALLOWED_DEVICE_ORIGINS.includes(origin);
  });

  window.on('enter-full-screen', () => {
    window.webContents.send(ElectronEvent.FULLSCREEN_CHANGE, true);
  });

  window.on('leave-full-screen', () => {
    window.webContents.send(ElectronEvent.FULLSCREEN_CHANGE, false);
  });

  window.on('close', (event) => {
    if (IS_MAC_OS || IS_WINDOWS) {
      if (forceQuit.isEnabled) {
        app.exit(0);
        forceQuit.disable();
      } else if (hasExtraWindows()) {
        windows.delete(window);
        windowState.unmanage();
      } else {
        event.preventDefault();
        window.hide();
      }
    }
  });

  if (url) {
    window.loadURL(url);
  } else if (app.isPackaged) {
    window.loadURL(`file://${__dirname}/index.html${windowState.urlHash}`);
  } else {
    window.loadURL(`http://localhost:1234${windowState.urlHash}`);
    window.webContents.openDevTools();
  }

  windowState.clearLastUrlHash();

  if (!IS_MAC_OS) {
    window.removeMenu();
  }

  if (IS_WINDOWS && tray.isEnabled) {
    tray.setupListeners(window);
    tray.create();
  }

  window.webContents.once('dom-ready', () => {
    window.show();
    processDeeplink();

    if (process.env.APP_ENV === 'production') {
      setupAutoUpdates(window, windowState);
    }
  });

  windows.add(window);
}

export function setupElectronActionHandlers() {
  ipcMain.handle(ElectronAction.OPEN_NEW_WINDOW, (_, url: string) => {
    createWindow(url);
  });

  ipcMain.handle(ElectronAction.SET_WINDOW_TITLE, (_, newTitle?: string) => {
    getCurrentWindow()?.setTitle(getAppTitle(newTitle));
  });

  ipcMain.handle(ElectronAction.GET_IS_FULLSCREEN, () => {
    getCurrentWindow()?.isFullScreen();
  });

  ipcMain.handle(ElectronAction.HANDLE_DOUBLE_CLICK, () => {
    const currentWindow = getCurrentWindow();
    const doubleClickAction = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');

    if (doubleClickAction === 'Minimize') {
      currentWindow?.minimize();
    } else if (doubleClickAction === 'Maximize') {
      if (!currentWindow?.isMaximized()) {
        currentWindow?.maximize();
      } else {
        currentWindow?.unmaximize();
      }
    }
  });

  ipcMain.handle(ElectronAction.SET_TRAFFIC_LIGHT_POSITION, (_, position: TrafficLightPosition) => {
    if (!IS_MAC_OS) {
      return;
    }

    getCurrentWindow()?.setTrafficLightPosition(TRAFFIC_LIGHT_POSITION[position]);
  });

  ipcMain.handle(ElectronAction.SET_IS_TRAY_ICON_ENABLED, (_, value: boolean) => {
    if (value) {
      tray.enable();
    } else {
      tray.disable();
    }
  });

  ipcMain.handle(ElectronAction.GET_IS_TRAY_ICON_ENABLED, () => tray.isEnabled);
}

export function setupCloseHandlers() {
  app.on('window-all-closed', () => {
    if (!IS_MAC_OS) {
      app.quit();
    }
  });

  app.on('before-quit', (event) => {
    if (IS_MAC_OS && !forceQuit.isEnabled) {
      event.preventDefault();
      forceQuit.enable();
      app.quit();
    }
  });

  app.on('activate', () => {
    const hasActiveWindow = BrowserWindow.getAllWindows().length > 0;

    if (!hasActiveWindow) {
      createWindow();
    } else if (IS_MAC_OS) {
      forceQuit.disable();
      getLastWindow()?.show();
    }
  });
}
