import {
  app, BrowserWindow, ipcMain, shell, systemPreferences,
} from 'electron';
import type { HandlerDetails } from 'electron';
import type { UpdateInfo } from 'electron-updater';
import { autoUpdater } from 'electron-updater';
import windowStateKeeper from 'electron-window-state';
import path from 'path';

import { ElectronAction, ElectronEvent } from '../types/electron';
import { IS_MAC_OS } from './utils';

let forceQuit = false;
let interval: NodeJS.Timer;

const windows = new Set<BrowserWindow>();
const CHECK_UPDATE_INTERVAL = 10 * 60 * 1000;

export function createWindow(url?: string) {
  const windowState = windowStateKeeper({
    defaultWidth: 1088,
    defaultHeight: IS_MAC_OS ? 700 : 750,
  });

  let x;
  let y;

  const currentWindow = BrowserWindow.getFocusedWindow();
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
    title: 'Telegram A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: process.env.APP_ENV !== 'production',
    },
    ...(IS_MAC_OS && {
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 10, y: 20 },
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

  window.on('enter-full-screen', () => {
    window.webContents.send(ElectronEvent.FULLSCREEN_CHANGE, true);
  });

  window.on('leave-full-screen', () => {
    window.webContents.send(ElectronEvent.FULLSCREEN_CHANGE, false);
  });

  window.on('close', (event) => {
    if (IS_MAC_OS) {
      if (forceQuit) {
        app.exit(0);
        forceQuit = false;
      } else {
        const hasExtraWindows = BrowserWindow.getAllWindows().length > 1;

        if (hasExtraWindows) {
          windows.delete(window);
        } else {
          event.preventDefault();
          window.hide();
        }
      }
    }
  });

  if (url) {
    window.loadURL(url);
  } else if (app.isPackaged) {
    window.loadURL(`file://${__dirname}/index.html`);
  } else {
    window.loadURL('http://localhost:1234');
    window.webContents.openDevTools();
  }

  if (!IS_MAC_OS) {
    window.removeMenu();
  }

  window.webContents.once('dom-ready', () => {
    window.show();
    setupAutoUpdates(window);
  });

  windows.add(window);
}

function setupAutoUpdates(window: BrowserWindow) {
  if (!interval) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.checkForUpdates();

    interval = setInterval(() => autoUpdater.checkForUpdates(), CHECK_UPDATE_INTERVAL);

    ipcMain.handle(ElectronAction.INSTALL_UPDATE, () => {
      if (IS_MAC_OS) {
        forceQuit = true;
      }

      return autoUpdater.quitAndInstall();
    });
  }

  autoUpdater.on('error', (error: Error) => {
    if (windows.has(window)) {
      window.webContents.send(ElectronEvent.UPDATE_ERROR, error);
    }
  });
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    if (windows.has(window)) {
      window.webContents.send(ElectronEvent.UPDATE_DOWNLOADED, info);
    }
  });
}

export function setupElectronActionHandlers() {
  ipcMain.handle(ElectronAction.OPEN_NEW_WINDOW, (_, newWindowUrl: string) => {
    createWindow(newWindowUrl);
  });

  ipcMain.handle(ElectronAction.GET_IS_FULLSCREEN, () => {
    const currentWindow = BrowserWindow.getFocusedWindow();
    currentWindow?.isFullScreen();
  });

  ipcMain.handle(ElectronAction.HANDLE_DOUBLE_CLICK, () => {
    const currentWindow = BrowserWindow.getFocusedWindow();
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
}

export function setupCloseHandlers() {
  app.on('window-all-closed', () => {
    if (!IS_MAC_OS) {
      app.quit();
    }
  });

  app.on('before-quit', (event) => {
    if (IS_MAC_OS && !forceQuit) {
      event.preventDefault();
      forceQuit = true;
      app.quit();
    }
  });

  app.on('activate', () => {
    const hasActiveWindow = BrowserWindow.getAllWindows().length > 0;

    if (!hasActiveWindow) {
      createWindow();
    } else if (IS_MAC_OS) {
      forceQuit = false;

      const currentWindow = Array.from(windows).pop();
      currentWindow?.show();
    }
  });
}
