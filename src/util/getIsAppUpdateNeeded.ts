const APP_VERSION_REGEX = /^\d+\.\d+(\.\d+)?$/;

export default function getIsAppUpdateNeeded(remoteVersion: string, appVersion: string) {
  return APP_VERSION_REGEX.test(remoteVersion) && remoteVersion !== appVersion;
}
