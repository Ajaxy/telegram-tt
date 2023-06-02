import { contextBridge, ipcRenderer } from 'electron';

import type { IpcRendererEvent } from 'electron';
import type { ElectronApi, ElectronEvent } from '../types/electron';
import { ElectronAction } from '../types/electron';

const electronApi: ElectronApi = {
  isFullscreen: () => ipcRenderer.invoke(ElectronAction.GET_IS_FULLSCREEN),
  installUpdate: () => ipcRenderer.invoke(ElectronAction.INSTALL_UPDATE),
  handleDoubleClick: () => ipcRenderer.invoke(ElectronAction.HANDLE_DOUBLE_CLICK),
  openNewWindow: (url: string) => ipcRenderer.invoke(ElectronAction.OPEN_NEW_WINDOW, url),

  on: (eventName: ElectronEvent, callback) => {
    const subscription = (event: IpcRendererEvent, ...args: any) => callback(...args);

    ipcRenderer.on(eventName, subscription);

    return () => {
      ipcRenderer.removeListener(eventName, subscription);
    };
  },
};

contextBridge.exposeInMainWorld('electron', electronApi);
