import { DEBUG, DEBUG_MORE } from '../config';
import { getActions } from '../global';
import { IS_ANDROID, IS_IOS, IS_SERVICE_WORKER_SUPPORTED } from './environment';
import { notifyClientReady, playNotifySoundDebounced } from './notifications';

type WorkerAction = {
  type: string;
  payload: Record<string, any>;
};

function handleWorkerMessage(e: MessageEvent) {
  const action: WorkerAction = e.data;
  if (DEBUG_MORE) {
    // eslint-disable-next-line no-console
    console.log('[SW] Message from worker', action);
  }
  if (!action.type) return;
  const dispatch = getActions();
  const payload = action.payload;
  switch (action.type) {
    case 'focusMessage':
      if (dispatch.focusMessage) {
        dispatch.focusMessage(payload);
      }
      if (dispatch.startActiveReaction && payload.reaction) {
        dispatch.startActiveReaction({
          messageId: payload.messageId,
          reaction: payload.reaction,
        });
      }
      break;
    case 'playNotificationSound':
      playNotifySoundDebounced(action.payload.id);
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
      if (!navigator.serviceWorker.controller) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length) {
          if (DEBUG) {
            // eslint-disable-next-line no-console
            console.log('[SW] Hard reload detected, re-enabling Service Worker');
          }
          await Promise.all(registrations.map((r) => r.unregister()));
        }
      }

      await navigator.serviceWorker.register(new URL('../serviceWorker.ts', import.meta.url));

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

        if (!IS_IOS && !IS_ANDROID) {
          getActions().showDialog({ data: { message: 'SERVICE_WORKER_DISABLED', hasErrorKey: true } });
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
