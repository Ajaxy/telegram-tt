import type { ApiSession } from '../../../../api/types';
import type { DeviceType } from '../../../../types/icons/device';

export default function getSessionIcon(session: ApiSession): DeviceType {
  const platform = session.platform.toLowerCase();
  const device = session.deviceModel.toLowerCase();
  const systemVersion = session.systemVersion.toLowerCase();

  if (device.includes('xbox')) {
    return 'xbox';
  }

  if (device.includes('chrome') && !device.includes('chromebook')) {
    return 'chrome';
  }
  if (device.includes('brave')) {
    return 'brave';
  }
  if (device.includes('vivaldi')) {
    return 'vivaldi';
  }
  if (device.includes('safari')) {
    return 'safari';
  }
  if (device.includes('firefox')) {
    return 'firefox';
  }
  if (device.includes('opera')) {
    return 'opera';
  }
  if (device.includes('samsungbrowser')) {
    return 'samsung';
  }
  if (platform.includes('android')) {
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
