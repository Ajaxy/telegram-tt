import type { ApiSession } from '../../../../api/types';
import type { IconName } from '../../../../types/icons';
import type { DeviceType } from '../../../../types/icons/device';
import type { IconBackdropColor } from '../../../gili/primitives/IconBackdrop';

const WEB_CODE_NAME_REGEX = /\b(a|k)\b\s*$/;

export const DEVICE_BACKDROP: Record<DeviceType, { icon: IconName; color: IconBackdropColor }> = {
  weba: { icon: 'device-weba', color: 'purple' },
  webk: { icon: 'device-webk', color: 'purple' },
  web: { icon: 'web-filled', color: 'purple' },
  apple: { icon: 'device-apple', color: 'blue' },
  android: { icon: 'device-android', color: 'green' },
  windows: { icon: 'device-windows', color: 'blue' },
  ubuntu: { icon: 'device-ubuntu', color: 'red' },
  linux: { icon: 'device-linux', color: 'orange' },
  unknown: { icon: 'device-unknown', color: 'gray' },
};

export default function getSessionIcon(session: ApiSession): DeviceType {
  const platform = session.platform.toLowerCase();
  const device = session.deviceModel.toLowerCase();
  const systemVersion = session.systemVersion.toLowerCase();
  const app = `${session.appName} ${session.appVersion}`.toLowerCase();

  if (app.includes('web') || platform.includes('web')) {
    if (app.includes('webk')) {
      return 'webk';
    }
    if (app.includes('weba')) {
      return 'weba';
    }

    const codeName = app.match(WEB_CODE_NAME_REGEX)?.[1];
    if (codeName === 'k') {
      return 'webk';
    }
    if (codeName === 'a') {
      return 'weba';
    }

    return 'web';
  }

  if (platform.includes('android') || systemVersion.includes('android')) {
    return 'android';
  }
  if (
    device.includes('iphone')
    || device.includes('ipad')
    || platform.includes('ios')
    || platform.includes('macos')
    || systemVersion.includes('macos')
  ) {
    return 'apple';
  }
  if (platform.includes('ubuntu') || systemVersion.includes('ubuntu')) {
    return 'ubuntu';
  }
  if (platform.includes('linux') || systemVersion.includes('linux')) {
    return 'linux';
  }
  if (platform.includes('windows') || systemVersion.includes('windows')) {
    return 'windows';
  }

  return 'unknown';
}
