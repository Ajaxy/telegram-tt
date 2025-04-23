import type { ApiLanguage } from '../../api/types';
import type {
  AnimationLevel,
  PerformanceType,
  Point,
  Size,
  ThemeKey,
  TimeFormat,
} from '../../types';

export type SharedState = {
  settings: {
    shouldUseSystemTheme: boolean;
    theme: ThemeKey;
    language: string;
    languages?: ApiLanguage[];
    performance: PerformanceType;
    messageTextSize: number;
    animationLevel: AnimationLevel;
    messageSendKeyCombo: 'enter' | 'ctrl-enter';
    miniAppsCachedPosition?: Point;
    miniAppsCachedSize?: Size;
    timeFormat: TimeFormat;
    wasTimeFormatSetManually: boolean;
    isConnectionStatusMinimized: boolean;
    canDisplayChatInTitle: boolean;
    shouldForceHttpTransport?: boolean;
    shouldAllowHttpTransport?: boolean;
    shouldCollectDebugLogs?: boolean;
    shouldDebugExportedSenders?: boolean;
    shouldWarnAboutSvg?: boolean;
    shouldSkipWebAppCloseConfirmation: boolean;
  };
  isInitial?: true;
};
