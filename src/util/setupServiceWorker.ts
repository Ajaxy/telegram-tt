import { getActions } from '../global';

import { DEBUG, IS_TEST } from '../config';
// eslint-disable-next-line import-x/default
import serviceWorkerUrl from '../serviceWorker/service.worker.ts?worker&url';
import { IS_ANDROID, IS_IOS, IS_SERVICE_WORKER_SUPPORTED } from './browser/windowEnvironment';
import { formatShareText } from './deeplink';
import { validateFiles } from './files';
import { notifyClientReady, playNotifySoundDebounced } from './notifications';
import { handlePushWorkerMessage, initPushNotifications, notifyPushClientReady } from './pushNotifications';

type WorkerAction = {
  type: string;
  payload: Record<string, any>;
};

const IGNORE_WORKER_PATH = '/k/';
const CONTROLLER_TIMEOUT_MS = 3000;
const SERVICE_WORKER_OPTIONS: RegistrationOptions = import.meta.env.DEV
  ? { scope: './', type: 'module' }
  : { type: 'module' };

function handleWorkerMessage(e: MessageEvent) {
  const action: WorkerAction = e.data;
  void handlePushWorkerMessage(e).catch(() => undefined);
  if (!action.type) return;
  const dispatch = getActions();
  const payload = action.payload;
  switch (action.type) {
    case 'playNotificationSound':
      playNotifySoundDebounced(action.payload.id);
      break;
    case 'share':
      dispatch.openChatWithDraft({
        text: formatShareText(payload.url, payload.text, payload.title),
        files: validateFiles(payload.files),
      });
      break;
  }
}

let subscribedController: ServiceWorker | undefined;

function subscribeToWorker() {
  // Both `controllerchange` and the load handler can report the same controller
  if (subscribedController === navigator.serviceWorker.controller) return;
  subscribedController = navigator.serviceWorker.controller || undefined;

  navigator.serviceWorker.removeEventListener('message', handleWorkerMessage);
  navigator.serviceWorker.addEventListener('message', handleWorkerMessage);
  // Notify web worker that client is ready to receive messages
  notifyClientReady();
  initPushNotifications();
  notifyPushClientReady();
}

if (IS_SERVICE_WORKER_SUPPORTED) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (navigator.serviceWorker.controller) subscribeToWorker();
  });

  window.addEventListener('load', async () => {
    try {
      const controller = navigator.serviceWorker.controller;
      if (controller?.scriptURL.includes(IGNORE_WORKER_PATH)) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const ourRegistrations = registrations.filter((r) => !r.scope.includes(IGNORE_WORKER_PATH));
        if (ourRegistrations.length) {
          if (DEBUG) {
            // eslint-disable-next-line no-console
            console.log('[SW] Hard reload detected, re-enabling Service Worker');
          }
          await Promise.all(ourRegistrations.map((r) => r.unregister()));
        }
      }

      await navigator.serviceWorker.register(serviceWorkerUrl, SERVICE_WORKER_OPTIONS);

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[SW] ServiceWorker registered');
      }

      const registration = await navigator.serviceWorker.ready;

      if (!navigator.serviceWorker.controller && registration.active) {
        const worker = registration.active;
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(finish, CONTROLLER_TIMEOUT_MS);

          function finish() {
            clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener('controllerchange', finish);
            resolve();
          }

          navigator.serviceWorker.addEventListener('controllerchange', finish);
          worker.postMessage({ type: 'claimClient' });
        });
      }

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

        if (!IS_IOS && !IS_ANDROID && !IS_TEST) {
          getActions().showDialog?.({ data: { type: 'error', message: 'SERVICE_WORKER_DISABLED', hasErrorKey: true } });
        }
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
