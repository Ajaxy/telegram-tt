const CLIENT_ID_PATTERN = /^[\da-f]{64}$/i;
const MAX_CONNECT_REQUEST_LENGTH = 1024 * 1024;
const START_APP_PREFIX = /^tonconnect-/i;

export function isTonConnectLink(url: string) {
  return /^tc:/i.test(url);
}

// The TON Connect SDK folds the `tc://connect` query into `startapp`: `=` is `__`, `&` is `-`, `%` is `--`
export function buildTonConnectLinkFromStartApp(startApp: string): string | undefined {
  if (!START_APP_PREFIX.test(startApp)) return undefined;

  const query = startApp.replace(START_APP_PREFIX, '')
    .replace(/--/g, '%')
    .replace(/__/g, '=')
    .replace(/-/g, '&');

  return `tc://connect?${query}`;
}

export async function parseTonConnectLink(url: string) {
  const parsed = new URL(url);
  const { searchParams } = parsed;
  const dappClientId = searchParams.get('id');
  const request = searchParams.get('r');

  if (!/^tc:\/\//i.test(url) || parsed.protocol !== 'tc:'
    || !['', 'connect'].includes(parsed.hostname.toLowerCase()) || !['', '/'].includes(parsed.pathname)
    || parsed.username || parsed.password || parsed.port || parsed.hash
    || ['v', 'id', 'r'].some((name) => searchParams.getAll(name).length !== 1)
    || searchParams.get('v') !== '2' || !dappClientId || !CLIENT_ID_PATTERN.test(dappClientId)
    || !request || request.length > MAX_CONNECT_REQUEST_LENGTH) {
    throw new Error('Invalid TON Connect link');
  }

  const { parseTonConnectConnectRequest } = await import('../lib/ton/connectRequest');

  return {
    dappClientId: dappClientId.toLowerCase(),
    connectRequest: parseTonConnectConnectRequest(JSON.parse(request)),
    traceId: searchParams.get('trace_id') || undefined,
  };
}
