import 'v8-compile-cache';

import {
  app, BrowserWindow, ipcMain, nativeImage,
} from 'electron';
import contextMenu from 'electron-context-menu';
import path from 'path';

import { initDeeplink } from './deeplink';
import { IS_MAC_OS, IS_WINDOWS } from './utils';
import { createWindow, setupCloseHandlers, setupElectronActionHandlers } from './window';

ipcMain.handle('can-go-back', () => {
  const webContents = BrowserWindow.getFocusedWindow()?.webContents;
  return webContents && !webContents.isDestroyed() ? webContents.canGoBack() : false;
});

ipcMain.handle('can-go-forward', () => {
  const webContents = BrowserWindow.getFocusedWindow()?.webContents;
  return webContents && !webContents.isDestroyed() ? webContents.canGoForward() : false;
});

ipcMain.on('go-back', () => {
  const webContents = BrowserWindow.getFocusedWindow()?.webContents;
  if (webContents?.canGoBack()) {
    webContents.goBack();
  }
});

ipcMain.on('go-forward', () => {
  const webContents = BrowserWindow.getFocusedWindow()?.webContents;
  if (webContents?.canGoForward()) {
    webContents.goForward();
  }
});

initDeeplink();

contextMenu({
  showLearnSpelling: false,
  showLookUpSelection: false,
  showSearchWithGoogle: false,
  showCopyImage: false,
  showSelectAll: true,
});

app.on('ready', () => {
  if (IS_MAC_OS) {
    app.dock.setIcon(nativeImage.createFromPath(path.resolve(__dirname, '../public/icon-electron-macos.png')));
  }

  if (IS_WINDOWS) {
    app.setAppUserModelId(app.getName());
  }

  createWindow();
  setupElectronActionHandlers();
  setupCloseHandlers();
});
