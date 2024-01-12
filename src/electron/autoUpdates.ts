import {
  app, BrowserWindow, ipcMain, net,
} from 'electron';
import type { UpdateInfo } from 'electron-updater';
import { autoUpdater } from 'electron-updater';

import type { WindowState } from './windowState';
import { ElectronAction, ElectronEvent } from '../types/electron';

import { PRODUCTION_URL } from '../config';
import getIsAppUpdateNeeded from '../util/getIsAppUpdateNeeded';
import { pause } from '../util/schedulers';
import {
  forceQuit, IS_MAC_OS, IS_PREVIEW, IS_WINDOWS, store,
} from './utils';

export const AUTO_UPDATE_SETTING_KEY = 'autoUpdate';

const ELECTRON_APP_VERSION_URL = 'electronVersion.txt';
const CHECK_UPDATE_INTERVAL = 5 * 60 * 1000;

let isUpdateCheckStarted = false;

export default function setupAutoUpdates(state: WindowState) {
  if (isUpdateCheckStarted) {
    return;
  }

  isUpdateCheckStarted = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  checkForUpdates();

  ipcMain.handle(ElectronAction.INSTALL_UPDATE, () => {
    state.saveLastUrlHash();

    if (IS_MAC_OS || IS_WINDOWS) {
      forceQuit.enable();
    }

    return autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (error: Error) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(ElectronEvent.UPDATE_ERROR, error);
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(ElectronEvent.UPDATE_AVAILABLE, info);
    });
  });
}

export function getIsAutoUpdateEnabled() {
  return !IS_PREVIEW && store.get(AUTO_UPDATE_SETTING_KEY);
}

async function checkForUpdates(): Promise<void> {
  while (true) { // eslint-disable-line no-constant-condition
    if (await shouldPerformAutoUpdate()) {
      if (getIsAutoUpdateEnabled()) {
        autoUpdater.checkForUpdates();
      } else {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send(ElectronEvent.UPDATE_AVAILABLE);
        });
      }
    }

    await pause(CHECK_UPDATE_INTERVAL);
  }
}

function shouldPerformAutoUpdate(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = net.request(`${PRODUCTION_URL}/${ELECTRON_APP_VERSION_URL}?${Date.now()}`);

    request.on('response', (response) => {
      let contents = '';

      response.on('end', () => {
        resolve(getIsAppUpdateNeeded(contents, app.getVersion(), true));
      });

      response.on('data', (data: Buffer) => {
        contents = `${contents}${String(data)}`;
      });

      response.on('error', () => {
        resolve(false);
      });
    });

    request.on('error', () => {
      resolve(false);
    });

    request.end();
  });
}
