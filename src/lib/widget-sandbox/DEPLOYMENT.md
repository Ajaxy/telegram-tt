# Widget runtime response policies

The runtime needs no cross-origin isolation: a widget's synchronous layout
queries wait for the page's answer through JavaScript Promise Integration (local
patch, NOTICE.md). It needs JSPI and module workers; a browser without them shows
"Unsupported browser" in the widget's place.

A Worker loaded from a URL runs under the CSP of its own script response, not the
document's. The app's service worker serves the widget Worker
(`widgetSandbox.worker-<hash>.js`) with its own policy, set over whatever the
server sends (`src/serviceWorker/service.worker.ts`): same-origin code and WASM
loading, WASM compilation, and same-origin fetches for its WASM file, nothing
else. No server configuration is needed. Where the service worker does not
control the load (the first visit before it activates, a hard reload, a browser
without service workers, the dev server's source path), the Worker runs under
whatever the server sends, the page's own policy in dev and preview. QuickJS
guest code has no fetch, XHR, WebSocket or browser Worker APIs either way: the
policy only limits what an escape from the engine could do.

Widgets render through a shadow root in the application page, with the validator
in `scope: 'shadow'`. There is no per-widget frame or CSP: the page's own policy
is the second layer behind the validator and the renderer's checks. Upstream's
invariant 6 asks that policy to limit `connect-src` to Telegram's endpoints and
to keep third-party origins out of `frame-src`; the page keeps both open for Mini
Apps and TON Connect. This does not guarantee immunity to rendering DoS or
containment of a browser Worker-realm exploit.

Widget local storage uses the account cache's existing encrypted vault path
when a passcode is enabled. Session storage is excluded from disk serialization;
the existing passcode lock also purges it with other account memory.

The API worker inflates payloads as zlib only, with no size limit of its own (the
server enforces them), and decodes them as strict UTF-8.
