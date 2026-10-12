// The protocol of the Android app: the subscription is acknowledged by its `id`, and a `ping` keeps the socket checked
const SUBSCRIPTION_TYPES = ['transactions', 'account_state_change'];
const ACTIVITY_TYPES = [...SUBSCRIPTION_TYPES, 'trace_invalidated'];
const PING_ID = 'heartbeat';
const PING_INTERVAL_MS = 15000;
const PONG_TIMEOUT_MS = 30000;
const CONNECT_TIMEOUT_MS = 30000;
const MIN_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
// Spreads out the reconnects of many clients after a server restart
const MAX_RECONNECT_JITTER_MS = 500;

export type ActivityStreamUrl = {
  url: string;
  lifetimeMs: number;
};

type ActivityStreamParams = {
  address: string;
  fetchUrl: () => Promise<ActivityStreamUrl | undefined>;
  onActivity: NoneToVoidFunction;
};

// A reply to a request carries `id` and `status`, a notification carries `type`
type StreamingFrame = {
  id?: string;
  type?: string;
  status?: string;
  error?: unknown;
};

let params: ActivityStreamParams | undefined;
let socket: WebSocket | undefined;
let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
let reconnectDelay = MIN_RECONNECT_DELAY_MS;
let attemptId = 0;
// Missed activity is not replayed, so every subscription after the first reports activity to catch up
let hasSubscribed = false;

export function watchAddressActivity(next: ActivityStreamParams) {
  if (params?.address === next.address) return;

  unwatchAddressActivity();
  params = next;
  reconnectDelay = MIN_RECONNECT_DELAY_MS;
  hasSubscribed = false;
  void connect();
}

export function unwatchAddressActivity() {
  params = undefined;
  attemptId++;
  clearTimeout(reconnectTimeout);

  const current = socket;
  socket = undefined;
  current?.close();
}

async function connect() {
  const attempt = ++attemptId;
  const { address, fetchUrl, onActivity } = params!;

  const streaming = await fetchUrl();
  if (attempt !== attemptId) return;

  if (!streaming || streaming.lifetimeMs <= 0) {
    scheduleReconnect();
    return;
  }

  let current: WebSocket;

  try {
    current = new WebSocket(streaming.url);
  } catch {
    scheduleReconnect();
    return;
  }

  socket = current;

  const subscriptionId = `wallet-${attempt}`;
  let isSubscribed = false;
  let isExpired = false;
  let lastPongAt = 0;
  let pingInterval: ReturnType<typeof setInterval> | undefined;
  const connectTimeout = setTimeout(() => current.close(), CONNECT_TIMEOUT_MS);

  // An expiring URL is replaced right away rather than after the reconnect delay
  const expiryTimeout = setTimeout(() => {
    isExpired = true;
    current.close();
  }, streaming.lifetimeMs);

  current.onopen = () => {
    current.send(JSON.stringify({
      operation: 'subscribe', id: subscriptionId, types: SUBSCRIPTION_TYPES, addresses: [address],
      min_finality: 'pending',
    }));
  };

  current.onmessage = (e: MessageEvent) => {
    const frame = parseFrame(e.data);

    if (!frame || frame.error || frame.status === 'error') {
      current.close();
      return;
    }

    if (frame.status === 'subscribed' && frame.id === subscriptionId) {
      isSubscribed = true;
      clearTimeout(connectTimeout);

      // Reset only here, or a server dropping the socket right after the handshake is retried every second
      reconnectDelay = MIN_RECONNECT_DELAY_MS;
      lastPongAt = Date.now();

      pingInterval = setInterval(() => {
        if (Date.now() - lastPongAt > PONG_TIMEOUT_MS) {
          current.close();
          return;
        }

        current.send(JSON.stringify({ operation: 'ping', id: PING_ID }));
      }, PING_INTERVAL_MS);

      if (hasSubscribed) {
        onActivity();
      }

      hasSubscribed = true;
      return;
    }

    if (frame.status === 'pong' && frame.id === PING_ID) {
      lastPongAt = Date.now();
      return;
    }

    if (isSubscribed && frame.type && ACTIVITY_TYPES.includes(frame.type)) {
      onActivity();
    }
  };

  // An error is always followed by a close, so the close alone drives the retry
  current.onclose = () => {
    clearTimeout(connectTimeout);
    clearTimeout(expiryTimeout);
    clearInterval(pingInterval);

    if (socket !== current) return;

    socket = undefined;

    if (isExpired) {
      void connect();
    } else {
      scheduleReconnect();
    }
  };
}

function scheduleReconnect() {
  if (!params) return;

  reconnectTimeout = setTimeout(connect, reconnectDelay + Math.random() * MAX_RECONNECT_JITTER_MS);
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
}

function parseFrame(data: unknown): StreamingFrame | undefined {
  if (typeof data !== 'string') return undefined;

  try {
    return JSON.parse(data) as StreamingFrame;
  } catch {
    return undefined;
  }
}
