import Deferred from '../util/Deferred';

declare const self: ServiceWorkerGlobalScope;

type ShareData = {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
};

const READY_CLIENT_DEFERREDS = new Map<string, Deferred<void>>();

export async function respondForShare(e: FetchEvent) {
  if (e.request.method === 'POST') {
    try {
      const formData = await e.request.formData();
      const data = parseFormData(formData);
      requestShare(data, e.resultingClientId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[SHARE] Failed to parse input data', err);
    }
  }

  return Response.redirect('.');
}

export function handleClientMessage(e: ExtendableMessageEvent) {
  const { source, data } = e;
  if (!source) return;

  if (data.type === 'clientReady') {
    const { id } = (source as Client);
    const deferred = READY_CLIENT_DEFERREDS.get(id);
    if (deferred) {
      deferred.resolve();
    } else {
      READY_CLIENT_DEFERREDS.set(id, Deferred.resolved());
    }
  }
}

async function requestShare(data: ShareData, clientId: string) {
  const client = await self.clients.get(clientId);
  if (!client) {
    return;
  }

  await getClientReadyDeferred(clientId);

  client.postMessage({
    type: 'share',
    payload: data,
  });
}

function getClientReadyDeferred(clientId: string) {
  const deferred = READY_CLIENT_DEFERREDS.get(clientId);
  if (deferred) {
    return deferred.promise;
  }

  const newDeferred = new Deferred<void>();
  READY_CLIENT_DEFERREDS.set(clientId, newDeferred);
  return newDeferred.promise;
}

function parseFormData(formData: FormData): ShareData {
  const files = formData.getAll('files') as File[];
  const title = formData.get('title') as string;
  const text = formData.get('text') as string;
  const url = formData.get('url') as string;

  return {
    title,
    text,
    url,
    files,
  };
}
