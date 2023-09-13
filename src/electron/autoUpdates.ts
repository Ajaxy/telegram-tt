import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import type { UpdateInfo } from 'electron-updater';
import { autoUpdater } from 'electron-updater';

import type { WindowState } from './windowState';
import { ElectronAction, ElectronEvent } from '../types/electron';

import { forceQuit, IS_MAC_OS, windows } from './utils';

let interval: NodeJS.Timer;
const CHECK_UPDATE_INTERVAL = 5 * 60 * 1000;

export default function setupAutoUpdates(window: BrowserWindow, state: WindowState) {
  if (!interval) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.checkForUpdates();

    interval = setInterval(() => autoUpdater.checkForUpdates(), CHECK_UPDATE_INTERVAL);

    ipcMain.handle(ElectronAction.INSTALL_UPDATE, () => {
      state.saveLastUrlHash();

      if (IS_MAC_OS) {
        forceQuit.enable();
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
