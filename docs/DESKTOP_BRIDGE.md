# Desktop bridge (`__telegramDesktopBridge`)

For Electron (or other hosts) that must keep **one** MTProto session in the telegram-tt **web worker**, use this bridge from the **renderer** process after the app is logged in.

## Deploy

The bridge exists **only in this fork’s build**. If **`window.__telegramDesktopBridge`** is missing entirely, the site is serving an **old bundle** — rebuild from branch `EN-6083-feature/localdb-api-and-s3-deploy` (or equivalent) and **redeploy** (e.g. S3).

## Globals (after bundle load)

- `window.callApi` — existing fork hook; posts to GramJS worker.
- `window.__telegramDesktopBridge` — set **synchronously** on `window` (stub first, then wired when GramJS loads):
  - **`ready`** — `Promise<void>` that resolves when `callApi` and download methods are active.
  - **`ping()`** → `false` until GramJS is wired, then **`true`**.
  - **`startDownload(metadata)`** → `callApi('startDownloadDeferredMedia', metadata)` → resolves **`{ downloadId }`** immediately; bytes stream as **`window.postMessage`** events (see below). Before `ready`, rejects with a clear error.
  - **`downloadDeferredMedia(metadata)`** → same as `callApi('downloadDeferredMedia', metadata)` (single buffered result). Before `ready`, rejects.

**Host usage:** `await window.__telegramDesktopBridge.ready` (or wait until `ping() === true`) before calling downloads — avoids races and false “bridge missing” checks.

## IPC / `Object.entries` errors in your host app

If your `MessagingBackend` does `Object.entries(somePayload)` and **`somePayload` is `undefined`**, you get `Cannot convert undefined or null to object`. Guard with `Object.entries(payload ?? {})` or validate before respond — that path is in **your** Electron code, not telegram-tt.

## `startDownload` → `tg-download-chunk` messages

After `startDownload` resolves with `{ downloadId }`, listen on the **page** `window`:

```ts
window.addEventListener('message', (ev) => {
  if (ev.data?.type !== 'tg-download-chunk') return;
  const { downloadId, offset, byteLength, chunk, done, error, mimeType, totalSize } = ev.data;
  // chunk: ArrayBuffer (transferred) for data parts; absent on terminal-only message
  // done: true when finished; error set on failure
});
```

Optional **`metadata.downloadId`** lets you correlate without waiting for the promise.

## `downloadDeferredMedia`

**Input:** `ApiDesktopDeferredMedia` (`src/api/types/desktopBridge.ts`)

- `id`, `accessHash` — decimal strings (may exceed JS safe integer).
- `fileReference` — standard or URL-safe base64.
- `dcId` — number.
- `mediaType` — `photo` uses `InputPhotoFileLocation`; `document` | `video` | `audio` | `voice` | `other` use `InputDocumentFileLocation`.
- `thumbSize` — optional; photos default to `y`; full files use `''` (omit or empty).
- `size` — optional byte hint for the downloader (recommended for large files).

**Output:** Same shape as progressive `downloadMedia`: `{ dataBlob: '', arrayBuffer, mimeType?, fullSize? }` so the worker can **transfer** the `ArrayBuffer` to the UI thread.

## Security

The bridge is powerful. Only load your build on **trusted origins**; treat XSS as full account access.

## Related

- Stop using a **second** GramJS client (e.g. Node) with the **same** auth keys while this client is connected — see `AUTH_KEY_DUPLICATED` / `docs/LOCALDB_EXPORT_WORKER.md`.
