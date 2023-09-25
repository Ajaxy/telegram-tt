import { app } from 'electron';
import path from 'path';

import { ElectronEvent } from '../types/electron';

import {
  getLastWindow, IS_LINUX, IS_MAC_OS, IS_WINDOWS,
} from './utils';

const TG_PROTOCOL = 'tg';

let deeplinkUrl: string | undefined;

export function initDeeplink() {
  const window = getLastWindow();

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(TG_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(TG_PROTOCOL);
  }

  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();

    return;
  }

  app.on('will-finish-launching', () => {
    app.on('open-url', (event: Event, url: string) => {
      event.preventDefault();
      deeplinkUrl = url;
      processDeeplink();
    });
  });

  if (IS_WINDOWS || IS_LINUX) {
    deeplinkUrl = findDeeplink(process.argv);
  }

  app.on('second-instance', (_, argv: string[]) => {
    if (IS_MAC_OS) {
      deeplinkUrl = argv[0];
    } else {
      deeplinkUrl = findDeeplink(argv);
    }

    processDeeplink();

    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }

      window.focus();
    }
  });
}

export function processDeeplink() {
  const window = getLastWindow();

  if (!window || !deeplinkUrl) {
    return;
  }

  window.webContents.send(ElectronEvent.DEEPLINK, deeplinkUrl);

  deeplinkUrl = undefined;
}

function findDeeplink(args: string[]) {
  return args.find((arg) => arg.startsWith(`${TG_PROTOCOL}://`));
}
