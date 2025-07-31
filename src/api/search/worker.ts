// eslint-disable-next-line no-console
console.log('>>> SEARCH WORKER');

const ws = new WebSocket('ws://localhost:3000/ws?sessionId=ecc944e0-edc4-4417-afa8-683bd66446c9');

ws.onopen = () => {
  // eslint-disable-next-line no-console
  console.log('>>> connected to search worker');

  // Register events
  ws.send(JSON.stringify({ type: 'server:event:register', data: { event: 'storage:search:messages:data' } }));
};

ws.onmessage = (event) => {
  // eslint-disable-next-line no-console
  console.log('>>> message to search worker', JSON.parse(event.data));

  self.postMessage(JSON.parse(event.data));
};

ws.onclose = () => {
  // eslint-disable-next-line no-console
  console.log('>>> disconnected from search worker');
};

ws.onerror = (event) => {
  // eslint-disable-next-line no-console
  console.log('>>> error from search worker', event);
};

self.onmessage = (msg) => {
  const { type, payload } = msg.data as { type: string; payload: any };

  // eslint-disable-next-line no-console
  console.log('>>> message from search worker', type, payload);

  ws.send(JSON.stringify({ type, data: payload }));
};
