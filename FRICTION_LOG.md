# Friction log

Open problems in code patterns, contributor practices, and tooling that contributors encounter but cannot reasonably resolve within their current task. This is a shared list for follow-up work when someone has time. Entries describe the problem and its impact; estimates and proposed fixes are not required, and resolution preferences or suggestions are welcome.

Before adding an entry or picking one up, follow the [friction log guidance in AGENTS.md](AGENTS.md#friction-log). Extend matching entries, recheck the current code before starting work, and remove resolved problems or update what remains.

## Tracking active requests inside actions

Async actions have no shared mechanism for checking whether their invocation is still current after an `await`. [TeactN](src/lib/teact/teactn.tsx) exposes completion promises through `getPromiseActions`, but overlapping calls still need feature-specific bookkeeping to prevent older results from overwriting newer state. [AI composition](src/global/actions/api/ai.ts) increments a counter, stores the request ID on the editor tab, and compares it after the API call. [Wallet actions](src/global/actions/api/wallet.ts) repeat this with counters and per-tab maps for state, limits, quotes, fees, and mnemonic loading. Contributors must maintain these guards alongside checks that the original UI context is still active.

The [worker connector](src/api/gramjs/worker/connector.ts) tracks transport requests internally, and [API invocation](src/api/gramjs/methods/client.ts) supports chat/thread and call-group cancellation. These mechanisms do not expose general active-request ownership to global action handlers, so request IDs and stale-response checks remain scattered across features.

## Reverting optimistic global updates

Optimistic actions manually save original values, publish local changes, call the API, and restore the affected paths when the request fails. In [chat actions](src/global/actions/api/chats.ts), `toggleJoinRequest` saves and restores both the chat's join-request flag and its full-info guard bot, while `setMainProfileTab` separately preserves the old tab. In [settings actions](src/global/actions/api/settings.ts), `sortChatUsernames` keeps a copy of the original usernames and restores it if reordering fails.

There is no shared rollback helper for these edits. Each action must keep its saved values and restoration paths aligned as the optimistic update evolves, including changes across multiple branches of global state. Failure can arrive after another invocation or unrelated state changes, so restoring an entire earlier global snapshot would discard intervening updates. Any shared support needs to preserve those updates and account for overlapping changes to the same fields.

## Rich notification content across the serialization boundary

[`showNotification`](src/global/actions/ui/initial.ts) stores notification payloads in tab global state, which is synchronized through [`BroadcastChannel`](src/util/browser/multitab.ts). [`ApiNotification`](src/api/types/misc.ts) accepts strings or localization parameter objects, message entities, predefined icons, and action descriptors. Advanced localization parameters also accept `TeactNode` replacements. Component-valued nodes contain function references, so a notification with a custom inline component can cause `BroadcastChannel.postMessage` to fail during state synchronization. The [renderer](src/components/ui/Notification.tsx) passes localized messages to `lang.with`, so it can consume these values locally. The remaining design question is how to request richer interactive content without placing non-serializable UI values in shared state.

Contributors wanting special elements must work within these representations or extend UI rendering separately. The preference is to keep richer content straightforward to request from actions without introducing a general component-description protocol or converting action files to TSX. The appropriate boundary between serializable notification data and UI composition remains an open design question.

## Separating app and local-tooling lint environments

[`tsconfig.json`](tsconfig.json) covers app source and excludes tests and selected GramJS generators, while [`tsconfig.script.json`](tsconfig.script.json) covers tests, development scripts, plugins, and configuration files. However, [`eslint.config.js`](eslint.config.js) applies the same broad Teact rules and both TypeScript projects to JavaScript and TypeScript files across the repository. The script config also inherits DOM/Web Worker libraries and bundler module resolution from [`tsconfig.base.json`](tsconfig.base.json). The split therefore does not clearly separate the rules and environment assumptions for browser code from tooling running locally in Node.

[`check:ts`](package.json) runs `tsc` against the app config, then repository-wide ESLint; it does not explicitly type-check the script project with a separate `tsc` invocation. This makes the compiler and lint coverage harder to reason about and maintain. The preference is a clear app configuration and a separate local tests/helpers configuration, retaining browser types where tests need them: [Vitest](vitest.config.ts) runs in Node with a jsdom environment, and tests import app code. Shared settings still need to stay consistent without blurring those boundaries.

## Localization type-checking cost

[`LangFnParameters`](src/util/localization/types.ts) builds mapped unions over generated translation keys, preserving each key's replacements and options. Regular replacements recursively accept other translation objects, and advanced replacements accept `TeactNode`. [`lang.with`](src/util/localization/types.ts) accepts the combined union, which [`ApiNotification`](src/api/types/misc.ts) also carries through messages and titles. The key interfaces come from [`generateLangTypes.ts`](dev/generateLangTypes.ts) and the generated [`language.d.ts`](src/types/language.d.ts), so consumers of stored translation objects face a broad recursive type.

Notification linting is reported to take roughly 40 seconds and 400 MB of memory; these figures are contributor observations, not a reproduced benchmark. The concrete `lang.with` call sites are in [`Notification.tsx`](src/components/ui/Notification.tsx), which already has two `@ts-expect-error` comments stating that language parameters are too complex; [`Notifications.tsx`](src/components/common/Notifications.tsx) maps the stored list to that renderer. These types are a suspected source of the cost, but the exact bottleneck needs profiling. The goal is useful localization checks without making routine edits disproportionately expensive or requiring complexity suppressions.
