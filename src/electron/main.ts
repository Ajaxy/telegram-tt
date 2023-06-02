import 'v8-compile-cache';

import { app, nativeImage } from 'electron';
import path from 'path';

import { createWindow, setupCloseHandlers, setupElectronActionHandlers } from './window';
import { IS_MAC_OS, IS_WINDOWS } from './utils';

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
