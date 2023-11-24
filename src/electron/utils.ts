import type { Point, WebContents } from 'electron';
import { app, BrowserWindow } from 'electron';
import Store from 'electron-store';
import fs from 'fs';

import type { TrafficLightPosition } from '../types/electron';

export const IS_MAC_OS = process.platform === 'darwin';
export const IS_WINDOWS = process.platform === 'win32';
export const IS_LINUX = process.platform === 'linux';
export const IS_PREVIEW = process.env.IS_PREVIEW === 'true';
export const IS_FIRST_RUN = !fs.existsSync(`${app.getPath('userData')}/config.json`);

export const windows = new Set<BrowserWindow>();
export const store: Store = new Store();

export function getCurrentWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow();
}

export function getLastWindow(): BrowserWindow | undefined {
  return Array.from(windows).pop();
}

export function hasExtraWindows(): boolean {
  return BrowserWindow.getAllWindows().length > 1;
}

export function reloadWindows(isAutoUpdateEnabled = true): void {
  BrowserWindow.getAllWindows().forEach((window: BrowserWindow) => {
    const { hash } = new URL(window.webContents.getURL());

    if (isAutoUpdateEnabled) {
      window.loadURL(`${process.env.BASE_URL}${hash}`);
    } else {
      window.loadURL(`file://${__dirname}/index.html${hash}`);
    }
  });
}

export function focusLastWindow(): void {
  if (BrowserWindow.getAllWindows().every((window) => !window.isVisible())) {
    BrowserWindow.getAllWindows().forEach((window) => window.show());
  } else {
    getLastWindow()?.focus();
  }
}

// Возвращает текущий webContents или null
export function getCurrentWebContents(): WebContents | null {
  const currentWindow = BrowserWindow.getFocusedWindow();
  // eslint-disable-next-line no-null/no-null
  return currentWindow ? currentWindow.webContents : null;
}

// Проверяет, можно ли перейти назад
export function canGoBack(): boolean {
  const contents = getCurrentWebContents();
  return contents ? contents.canGoBack() : false;
}

// Проверяет, можно ли перейти вперед
export function canGoForward(): boolean {
  const contents = getCurrentWebContents();
  return contents ? contents.canGoForward() : false;
}

// Переходит на предыдущую страницу, если это возможно
export function goBack(): void {
  const contents = getCurrentWebContents();
  if (contents && contents.canGoBack()) {
    contents.goBack();
  }
}

// Переходит на следующую страницу, если это возможно
export function goForward(): void {
  const contents = getCurrentWebContents();
  if (contents && contents.canGoForward()) {
    contents.goForward();
  }
}

export function getAppTitle(chatTitle?: string): string {
  const appName = app.getName();

  if (!chatTitle) {
    return appName;
  }

  return `${chatTitle} · ${appName}`;
}

export const TRAFFIC_LIGHT_POSITION: Record<TrafficLightPosition, Point> = {
  standard: { x: 14, y: 14 },
  lowered: { x: 10, y: 52 },
};

export const forceQuit = {
  value: false,

  enable() {
    this.value = true;
  },

  disable() {
    this.value = false;
  },

  get isEnabled(): boolean {
    return this.value;
  },
};
