const APP_VERSION_REGEX = /^\d+\.\d+(\.\d+)?$/;

export default function getIsAppUpdateNeeded(remoteVersion: string, appVersion: string) {
  const sanitizedRemoteVersion = remoteVersion.trim();

  return APP_VERSION_REGEX.test(sanitizedRemoteVersion) && sanitizedRemoteVersion !== appVersion;
}
