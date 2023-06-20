export function ensureProtocol(url?: string) {
  if (!url) {
    return undefined;
  }

  // HTTP was chosen by default as a fix for https://bugs.telegram.org/c/10712.
  // It is also the default protocol in the official TDesktop client.
  try {
    const parsedUrl = new URL(url);
    // eslint-disable-next-line no-script-url
    if (parsedUrl.protocol === 'javascript:') {
      return `http://${url}`;
    }

    return url;
  } catch (err) {
    return `http://${url}`;
  }
}
