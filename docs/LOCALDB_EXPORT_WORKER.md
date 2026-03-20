# Why `getLocalDbData` can break MTProto (and what we do about it)

## 1. Where `callApi` runs

`callApi` is invoked from the **dedicated Web Worker** that hosts GramJS:

```89:89:src/api/gramjs/worker/worker.ts
          const response = await callApi(name, ...args);
```

The UI thread sends `callMethod` to the worker; the worker runs `callApi` and posts `methodResponse` back (`connector.ts` / `worker.ts`).

So **`getLocalDbData` / `getLocalDbMediaMetadata` execute on the GramJS worker thread**, not on the main browser tab thread.

## 2. Workers are single-threaded

That worker has **one** JavaScript event loop for:

- `onmessage` (including every `callApi` request)
- GramJS MTProto I/O (sockets, timers, `async` continuations)
- Any **synchronous** work you do inside `callApi`

A long **synchronous** `JSON.stringify(hugeObject)` **monopolizes** that loop: other tasks (including processing incoming MTProto data) wait until it finishes. That can look like:

- delayed acks / timeouts
- “stuck” sends or odd recv behavior
- correlation with **how often** or **how big** the export is — not with “wrong” TL logic

So we are **not** claiming `getLocalDbData` creates unknown TL constructors; it can **worsen timing** on the same thread that parses MTProto.

## 3. `localDb` proxies: reads don’t spam BroadcastChannel

`localDb` buckets are wrapped in a `Proxy`. **`get`** only does `Reflect.get` — it does **not** enqueue `localDbUpdate`. **`set`** does. So a read-heavy `JSON.stringify` does not, by itself, flood multitab sync; the main concern remains **CPU + blocking time** on the worker.

## 4. Why a single `setTimeout(0)` is only partial

`await yieldToEventLoop()` (i.e. `setTimeout(0)`) defers the **start** of `JSON.stringify` to the next macrotask. The **stringify itself** is still one long synchronous run if the payload is large.

So we also **split serialization by top-level bucket** (e.g. `documents`, then yield, then `photos`, …): MTProto can run **between** buckets.

## 5. Limits of bucket splitting

Even per-bucket, `documents` alone can be huge — one bucket can still block for a long time. Mitigations:

- Prefer **`getLocalDbMediaMetadata`** (three buckets, media-only).
- **Throttle** full **`getLocalDbData`** (e.g. ≤ 1/s, avoid tight loops).
- Avoid hammering export **during** active send/download if you still see issues.

## 6. Main thread cost (secondary)

The worker `postMessage`s the serialized result to the tab. **Structured cloning** of a very large object also costs CPU (main thread + worker). That affects UI smoothness more than MTProto, but it’s another reason to keep payloads small.
