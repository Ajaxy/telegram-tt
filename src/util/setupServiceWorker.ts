import { scriptUrl } from 'service-worker-loader!../serviceWorker';

import { DEBUG } from '../config';
import { getDispatch } from '../lib/teact/teactn';
import { IS_SERVICE_WORKER_SUPPORTED } from './environment';

type WorkerAction = {
  type: string;
  payload: Record<string, any>;
};


function handleWorkerMessage(e: MessageEvent) {
  const action:WorkerAction = e.data;
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[SW] New action from service worker', action);
  }
  if (!action.type) return;
  const dispatch = getDispatch();
  switch (action.type) {
    case 'focusMessage':
      dispatch.focusMessage(action.payload);
      break;
  }
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

        navigator.serviceWorker.addEventListener('message', handleWorkerMessage);
      } else {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error('[SW] ServiceWorker not available');
        }
        getDispatch().showError({ error: { message: 'SERVICE_WORKER_DISABLED' } });
      }
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[SW] ServiceWorker registration failed: ', err);
      }
    }
  });
}
