import { checkIsWebContentsUrlAllowed, getLastWindow } from './utils';

let localStorage: Record<string, any> | undefined;

export async function captureLocalStorage(): Promise<void> {
  const lastWindow = getLastWindow();

  if (!lastWindow) {
    return;
  }

  const contents = lastWindow.webContents;
  const contentsUrl = contents.getURL();

  if (!checkIsWebContentsUrlAllowed(contentsUrl)) {
    return;
  }

  localStorage = await contents.executeJavaScript('({ ...localStorage });');
}

export async function restoreLocalStorage(): Promise<void> {
  const lastWindow = getLastWindow();

  if (!lastWindow || !localStorage) {
    return;
  }

  const contents = lastWindow.webContents;
  const contentsUrl = contents.getURL();

  if (!checkIsWebContentsUrlAllowed(contentsUrl)) {
    return;
  }

  await contents.executeJavaScript(
    Object.keys(localStorage).map(
      (key: string) => `localStorage.setItem('${key}', JSON.stringify(${localStorage![key]}))`,
    ).join(';'),
  );

  localStorage = undefined;
}
