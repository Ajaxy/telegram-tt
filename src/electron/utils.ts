import { app } from 'electron';
import type { BrowserWindow, Point } from 'electron';

import type { TrafficLightPosition } from '../types/electron';

export const windows = new Set<BrowserWindow>();

export const IS_MAC_OS = process.platform === 'darwin';
export const IS_WINDOWS = process.platform === 'win32';
export const IS_LINUX = process.platform === 'linux';

export function getAppTitle(chatTitle?: string): string {
  const appName = app.getName();

  if (!chatTitle) {
    return appName;
  }

  return `${chatTitle} · ${appName}`;
}

export const TRAFFIC_LIGHT_POSITION: Record<TrafficLightPosition, Point> = {
  standard: { x: 10, y: 20 },
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
