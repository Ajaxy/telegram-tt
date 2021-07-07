import { scriptUrl } from 'service-worker-loader!../serviceWorker';

import { DEBUG } from '../config';
import { getDispatch } from '../lib/teact/teactn';
import { IS_SERVICE_WORKER_SUPPORTED } from './environment';
import { notifyClientReady } from './notifications';

type WorkerAction = {
  type: string;
  payload: Record<string, any>;
};


function handleWorkerMessage(e: MessageEvent) {
  const action:WorkerAction = e.data;
  if (!action.type) return;
  const dispatch = getDispatch();
  switch (action.type) {
    case 'focusMessage':
      dispatch.focusMessage(action.payload);
      break;
  }
}

function subscribeToWorker() {
  navigator.serviceWorker.removeEventListener('message', handleWorkerMessage);
  navigator.serviceWorker.addEventListener('message', handleWorkerMessage);
  // Notify web worker that client is ready to receive messages
  notifyClientReady();
}

if (IS_SERVICE_WORKER_SUPPORTED) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register(scriptUrl);

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[SW] ServiceWorker registered');
      }

      await navigator.serviceWorker.ready;

      if (navigator.serviceWorker.controller) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.log('[SW] ServiceWorker ready');
        }
        subscribeToWorker();
      } else {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error('[SW] ServiceWorker not available');
        }
        getDispatch().showDialog({ data: { message: 'SERVICE_WORKER_DISABLED', hasErrorKey: true } });
      }
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[SW] ServiceWorker registration failed: ', err);
      }
    }
  });
  window.addEventListener('focus', async () => {
    await navigator.serviceWorker.ready;
    subscribeToWorker();
  });
}
