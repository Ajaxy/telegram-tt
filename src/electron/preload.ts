import type { IpcRendererEvent } from 'electron';
import { contextBridge, ipcRenderer } from 'electron';

import type { ElectronApi, ElectronEvent, WindowButtonsPosition } from '../types/electron';
import { ElectronAction } from '../types/electron';

const electronApi: ElectronApi = {
  isFullscreen: () => ipcRenderer.invoke(ElectronAction.GET_IS_FULLSCREEN),
  installUpdate: () => ipcRenderer.invoke(ElectronAction.INSTALL_UPDATE),
  handleDoubleClick: () => ipcRenderer.invoke(ElectronAction.HANDLE_DOUBLE_CLICK),
  openNewWindow: (url: string) => ipcRenderer.invoke(ElectronAction.OPEN_NEW_WINDOW, url),
  setWindowTitle: (title?: string) => ipcRenderer.invoke(ElectronAction.SET_WINDOW_TITLE, title),
  setWindowButtonsPosition:
    (position: WindowButtonsPosition) => ipcRenderer.invoke(ElectronAction.SET_WINDOW_BUTTONS_POSITION, position),
  setIsAutoUpdateEnabled: (value: boolean) => ipcRenderer.invoke(ElectronAction.SET_IS_AUTO_UPDATE_ENABLED, value),
  getIsAutoUpdateEnabled: () => ipcRenderer.invoke(ElectronAction.GET_IS_AUTO_UPDATE_ENABLED),
  setIsTrayIconEnabled: (value: boolean) => ipcRenderer.invoke(ElectronAction.SET_IS_TRAY_ICON_ENABLED, value),
  getIsTrayIconEnabled: () => ipcRenderer.invoke(ElectronAction.GET_IS_TRAY_ICON_ENABLED),
  restoreLocalStorage: () => ipcRenderer.invoke(ElectronAction.RESTORE_LOCAL_STORAGE),

  on: (eventName: ElectronEvent, callback) => {
    const subscription = (event: IpcRendererEvent, ...args: unknown[]) => callback(...args);

    ipcRenderer.on(eventName, subscription);

    return () => {
      ipcRenderer.removeListener(eventName, subscription);
    };
  },
};

contextBridge.exposeInMainWorld('electron', electronApi);
