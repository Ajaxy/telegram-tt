import { contextBridge, ipcRenderer } from 'electron';

import type { IpcRendererEvent } from 'electron';
import type { ElectronApi, ElectronEvent, TrafficLightPosition } from '../types/electron';
import { ElectronAction } from '../types/electron';

const electronApi: ElectronApi = {
  isFullscreen: () => ipcRenderer.invoke(ElectronAction.GET_IS_FULLSCREEN),
  installUpdate: () => ipcRenderer.invoke(ElectronAction.INSTALL_UPDATE),
  handleDoubleClick: () => ipcRenderer.invoke(ElectronAction.HANDLE_DOUBLE_CLICK),
  openNewWindow: (url: string) => ipcRenderer.invoke(ElectronAction.OPEN_NEW_WINDOW, url),
  setWindowTitle: (title?: string) => ipcRenderer.invoke(ElectronAction.SET_WINDOW_TITLE, title),
  setTrafficLightPosition:
    (position: TrafficLightPosition) => ipcRenderer.invoke(ElectronAction.SET_TRAFFIC_LIGHT_POSITION, position),

  on: (eventName: ElectronEvent, callback) => {
    const subscription = (event: IpcRendererEvent, ...args: any) => callback(...args);

    ipcRenderer.on(eventName, subscription);

    return () => {
      ipcRenderer.removeListener(eventName, subscription);
    };
  },
};

contextBridge.exposeInMainWorld('electron', electronApi);
