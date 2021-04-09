import { scriptUrl } from 'service-worker-loader!../serviceWorker';

import { DEBUG } from '../config';
import { IS_SERVICE_WORKER_SUPPORTED } from './environment';
import { getDispatch } from '../lib/teact/teactn';

if (IS_SERVICE_WORKER_SUPPORTED) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register(scriptUrl);

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('ServiceWorker registered');
      }

      await navigator.serviceWorker.ready;

      if (navigator.serviceWorker.controller) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.log('ServiceWorker ready');
        }
      } else {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error('ServiceWorker not available');
        }
        getDispatch().showError({ error: { message: 'SERVICE_WORKER_DISABLED' } });
      }
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('ServiceWorker registration failed: ', err);
      }
    }
  });
}
