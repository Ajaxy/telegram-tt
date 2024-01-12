const APP_VERSION_REGEX = /^\d+\.\d+(\.\d+)?$/;

export default function getIsAppUpdateNeeded(remoteVersion: string, appVersion: string, isStrict?: boolean) {
  const sanitizedRemoteVersion = remoteVersion.trim();

  if (!APP_VERSION_REGEX.test(sanitizedRemoteVersion)) {
    return false;
  }

  if (isStrict) {
    return sanitizedRemoteVersion.localeCompare(appVersion, undefined, { numeric: true, sensitivity: 'base' }) === 1;
  }

  return sanitizedRemoteVersion !== appVersion;
}
