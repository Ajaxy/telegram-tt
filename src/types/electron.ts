export enum ElectronEvent {
  FULLSCREEN_CHANGE = 'fullscreen-change',
  UPDATE_ERROR = 'update-error',
  UPDATE_DOWNLOADED = 'update-downloaded',
}

export enum ElectronAction {
  GET_IS_FULLSCREEN = 'get-is-fullscreen',
  INSTALL_UPDATE = 'install-update',
  HANDLE_DOUBLE_CLICK = 'handle-double-click',
  OPEN_NEW_WINDOW = 'open-new-window',
  SET_WINDOW_TITLE = 'set-window-title',
  SET_TRAFFIC_LIGHT_POSITION = 'set-traffic-light-position',
}

export type TrafficLightPosition = 'standard' | 'lowered';

export interface ElectronApi {
  isFullscreen: () => Promise<boolean>;
  installUpdate: () => Promise<void>;
  handleDoubleClick: () => Promise<void>;
  openNewWindow: (url: string, title?: string) => Promise<void>;
  setWindowTitle: (title?: string) => Promise<void>;
  setTrafficLightPosition: (position: TrafficLightPosition) => Promise<void>;
  on: (eventName: ElectronEvent, callback: any) => VoidFunction;
}

declare global {
  interface Window {
    electron?: ElectronApi;
  }
}
