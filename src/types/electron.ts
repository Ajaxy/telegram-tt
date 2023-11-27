export enum ElectronEvent {
  FULLSCREEN_CHANGE = 'fullscreen-change',
  UPDATE_ERROR = 'update-error',
  UPDATE_AVAILABLE = 'update-available',
  DEEPLINK = 'deeplink',
  NAVIGATION_CHANGED = 'navigation-changed',
}

export enum ElectronAction {
  GET_IS_FULLSCREEN = 'get-is-fullscreen',
  INSTALL_UPDATE = 'install-update',
  HANDLE_DOUBLE_CLICK = 'handle-double-click',
  OPEN_NEW_WINDOW = 'open-new-window',
  SET_WINDOW_TITLE = 'set-window-title',
  SET_TRAFFIC_LIGHT_POSITION = 'set-traffic-light-position',
  SET_IS_AUTO_UPDATE_ENABLED = 'set-is-auto-update-enabled',
  GET_IS_AUTO_UPDATE_ENABLED = 'get-is-auto-update-enabled',
  SET_IS_TRAY_ICON_ENABLED = 'set-is-tray-icon-enabled',
  GET_IS_TRAY_ICON_ENABLED = 'get-is-tray-icon-enabled',
  RESTORE_LOCAL_STORAGE = 'restore-local-storage',
  CAN_GO_BACK = 'can-go-back',
  CAN_GO_FORWARD = 'can-go-forward',
  GO_BACK = 'go-back',
  GO_FORWARD = 'go-forward',
}

export type TrafficLightPosition = 'standard' | 'lowered';

export interface ElectronApi {
  isFullscreen: () => Promise<boolean>;
  installUpdate: () => Promise<void>;
  handleDoubleClick: () => Promise<void>;
  openNewWindow: (url: string, title?: string) => Promise<void>;
  setWindowTitle: (title?: string) => Promise<void>;
  setTrafficLightPosition: (position: TrafficLightPosition) => Promise<void>;
  setIsAutoUpdateEnabled: (value: boolean) => Promise<void>;
  getIsAutoUpdateEnabled: () => Promise<boolean>;
  setIsTrayIconEnabled: (value: boolean) => Promise<void>;
  getIsTrayIconEnabled: () => Promise<boolean>;
  restoreLocalStorage: () => Promise<void>;
  canGoBack: () => Promise<boolean>;
  canGoForward: () => Promise<boolean>;
  goBack: () => void;
  goForward: () => void;
  on: (eventName: ElectronEvent, callback: any) => VoidFunction;
}

declare global {
  interface Window {
    electron?: ElectronApi;
  }
}
