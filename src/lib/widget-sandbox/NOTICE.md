# Widget sandbox provenance and notices

This directory vendors the web runtime from `telegram-air/widget-sandbox`,
version `0.6.5`, commit `1cde0068daba8437f53eac0b61c395d29b8f89e3`. The original third-party
inventory is retained in `UPSTREAM_THIRD_PARTY_NOTICES.md`; its native packages,
demo libraries and alternative renderers are not part of this integration.

The prebuilt QuickJS engine is the TelegramMessenger/quickjs fork, revision
`b526a817f188ef861eea7666d68361c7851673a0` (`b526a81` in
`quickjs/prebuilt/QUICKJS_VERSION`), not the vanilla npm QuickJS binary.
The vendored WASM SHA-256 is
`8045387ba4c7fc3f51da8292e86129ad958bf6802d8dadbd11b3878bd451aaab`.
Its MIT license and the quickjs-emscripten MIT license are retained in
`quickjs/`. The build uses quickjs-emscripten FFI/core `0.32.0`. Rebuilding that
binary requires an explicit checkout of the same fork revision, Emscripten,
CMake, Ninja and a host C compiler: `quickjs/build.sh /path/to/quickjs`.
The build support and C interface are retained; native application packages
are not required for the normal client build.

## Local changes

Paths are relative to this directory; `host/`, `renderer/`, `sandbox/` and `shared/` are under `src/`.

### Build and packaging

- The worker and QuickJS import paths are the client's, and the app's service worker gives the worker its CSP
  (`DEPLOYMENT.md`).
- The Shadow DOM renderer is the only one: the iframe renderer, its srcdoc and its bundle entry are removed. The
  native validator bundle is left out.
- The `sourceMappingURL` comments of `quickjs/prebuilt/index.mjs` and `ffi.mjs` are dropped: upstream does not ship
  their maps.
- The worker imports the sandbox bundle itself (`virtual:sandbox-bundle`, through `workerPlugin` in `vite.ts`), so
  `init` and `warm` do not carry it and the ~600 KB string stays out of the main thread's code.
- The CSS sanitizer takes css-tree's parser, walker, generator and `List` from their entry points
  (`host/css-tree.ts`), which leaves out the lexer and its syntax data.
- `quickjs/build.sh` takes the fork checkout as its argument, builds the browser module only into
  `quickjs/prebuilt/` (upstream `dist/`), and `--check` compares with `quickjs/prebuilt.sha256`.

### No cross-origin isolation (`host/suspend.ts`, `host/widgetSandbox.worker.ts`)

- A widget's layout query is a message to the host and its answer a message back (`answer`, numbered by `seq`),
  where upstream blocks the worker on a SharedArrayBuffer.
- The widget's code waits for the answer without knowing, through JavaScript Promise Integration (Baseline 2026:
  Chrome and Edge 137, Firefox 153, Safari 27), which the client requires: the QuickJS host call import is
  `WebAssembly.Suspending` and the exports that run code are `WebAssembly.promising`.
- The worker's tasks are generators that yield only where a query waits; inputs, timers and wake-ups that arrive
  meanwhile run after the task, in order. The technique follows tweb's `worker` transport, applied to upstream's one
  worker per widget.

### Host (`host/widget-host.ts`)

- The client's gesture, focus and protected-copy bridge. `shouldKeepFocus` keeps the composer focused on a finger's
  tap only: a mouse press on selectable text needs its default to select.
- `WidgetHostOptions.reducedMotion` answers `prefers-reduced-motion`.
- `WidgetHost.suspend()` ends the runtime (the worker is freed and `onDead` is not called) and keeps its last render
  as a still picture, `frozen` with no reason and so no badge: widgets that leave the viewport keep their picture
  without a worker until a new run has loaded.
- `WidgetHost` measures its own time on the worker's `ops`, `anim`, `listen` and `pd` and sends it back (`hostCost`),
  which the worker charges to the main-thread window; upstream's web glue only models the cost of ops.

### Worker and CPU quota (`host/widgetSandbox.worker.ts`, `host/cpu-budget.ts`)

- A deferred task that is still over the quota is requeued once, not twice.
- Inline scripts each keep their own slice, stop for the task once the quota is spent and continue in a deferred
  `scripts` task. `loaded` (`DOMContentLoaded`, `load`) fires once they have all run, after one deferred `scripts`
  task at the latest; a run that reaches 1000 scripts in a task goes on in the next.
- Events the page fires without input (`load`, `error`, `toggle`, animation and transition events) wait for the CPU
  quota like timers (the worker's `dispatch`).

### Validator and CSS (`host/validator.ts`, `host/css-sanitizer.ts`, `host/allowlist.ts`)

- In the shadow scope `matchMedia` answers from the widget's box (`containerMatches`), never the page's viewport,
  and a stylesheet `@media` that cannot become a `@container tw` query is dropped.
- An SVG `<style>` goes to the renderer as an HTML `<style>`, whose sheet the paint limits and the touch-action
  widening watch.
- `cursor` takes keywords only; `aria-live` and the live-region roles are dropped.
- The protocol does not take a native `addPath`, which the shim never sends and which can copy a path into itself.
- `Path2D.addPath` of a path made from SVG data sends that data as `['pc', pid, 'addSvgPath', d]`, at most as long as
  a `pn`'s SVG data, and the renderer adds it before the path's own commands (with `sandbox/canvas.ts` and
  `renderer/core.ts`).

### Renderer (`renderer/core.ts`, `host/shadow-renderer.ts`)

- The browser's animations pause when a stopped widget freezes, and script-made animations are cancelled on
  destroy.
- A canvas keeps at most 4096 `Path2D` objects and 4096 gradients, and a gradient 256 color stops. A widget gets at
  most 60 frames a second whatever the display's refresh rate.
- With `ShadowDomRenderer.emoji` set (the client's emoji images, exported from `index.js`), a text node with emoji
  outside SVG is drawn as a `display: contents` wrapper of its text runs and a `tw-emoji` box per emoji
  (`RendererEnv.emoji`); the widget still sees one text node. Their styles are an important `all: unset` in a layer
  of the renderer's sheet, which beats every widget rule, so no widget rule gives them a box the paint count misses.
  A widget makes at most 2048 emoji parts a second, 1024 at once.
- The page's custom properties, which a shadow root inherits, are unset on the shadow host, which no widget selector
  reaches, so they neither style the widget, nor answer its `getComputedStyle`, nor come back with `inherit`.
- A tap draws no highlight, as on the native clients; a widget may set its own.

### Shim (`sandbox/canvas.ts`, `sandbox/globals.ts`)

- Pending canvas commands are flushed before a `drawImage` whose source canvas was drawn on in the same task, so the
  renderer paints the source first; upstream sends each canvas's commands together.
- `matchMedia(…).matches` only reads, and setting `onchange` watches the list.
- A gradient or pattern drawn with on another canvas than the one that made it is made there too, with its color
  stops so far and every later one; the renderer keeps them per canvas, and the style was ignored there.

## Updating

Normal builds use the root lockfile and `createWidgetSandbox` in `vite.ts`.
The original esbuild sandbox options, generated profile tables and `profile.json`
are retained. To update, compare the upstream revision and these local changes,
copy the web sources/profile and the fork binary from one upstream revision,
retain its license notices, and regenerate declarations with
`node node_modules/typescript/bin/tsc -p src/lib/widget-sandbox/tsconfig.json`.
The root lint/TypeScript project excludes upstream source conventions; this
dedicated compiler project checks the vendored source and emits `types/` for
the typed client facades. Do not hand-edit those declarations.

## Third-party licenses

Runtime dependencies are pinned in the root lockfile. Their license texts are
retained under `licenses/`; the Vite build emits these, this notice and the
QuickJS licenses together as `widget-sandbox-notices.txt`.

| Component | Version(s) | License |
| --- | --- | --- |
| css-tree | 3.2.1 | MIT |
| linkedom | 0.18.13 | ISC |
| parse5 | 8.0.0 | MIT |
| quickjs-emscripten-core / @jitl/quickjs-ffi-types | 0.32.0 | MIT |
| boolbase | 2.0.0 | ISC |
| css-select / css-what | 7.0.0 / 8.0.0 | BSD-2-Clause |
| cssom / htmlparser2 | 0.5.0 / 10.1.0 | MIT |
| dom-serializer | 2.0.0, 3.1.1 | MIT |
| domelementtype | 2.3.0, 3.0.0 | BSD-2-Clause |
| domhandler | 5.0.3, 6.0.1 | BSD-2-Clause |
| domutils | 3.2.2, 4.0.2 | BSD-2-Clause |
| entities | 4.5.0, 6.0.1, 7.0.1, 8.1.0 | BSD-2-Clause |
| nth-check | 3.0.1 | BSD-2-Clause |
| source-map-js | 1.2.2 | BSD-3-Clause |
| uhyphen | 0.2.0 | ISC |

Build-only esbuild and CSS type declarations are covered by their installed
package licenses and are not shipped in the browser runtime.
