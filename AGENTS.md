# Project instructions

Telegram web app using TypeScript and Teact, a custom React-like UI library. Follow nearby code and the repository's ESLint and Stylelint configurations; the rules below capture project-specific constraints and review feedback.

## Scope and workflow

- Keep changes directly related to the request. Search for existing types, functions, components, and hooks before adding them.
- Use existing dependencies only. If the task requires a new library, stop and explain why.
- Make routine implementation decisions from the code and task context. Ask when ambiguity materially changes the work; continue independent, authorized work meanwhile.
- Only write tests when directly prompted to do so.
- Review the change for the smallest coherent design that satisfies the requirements. Fix substantive findings and repeat until none remain; avoid speculative abstractions, unused exports, and unrelated cleanup.
- Keep responses concise: summarize the result, verification, and any unresolved issue. If deeper debugging needs user involvement, provide concrete steps. Remove temporary debug code when resolved.

## Friction log

- Record concrete inefficiencies in code patterns, contributor practices, or tooling in [FRICTION_LOG.md](FRICTION_LOG.md) when resolving them exceeds the current task's scope. Keep the current task focused.
- Read existing entries first and extend a matching entry instead of adding a duplicate.
- Use a descriptive heading and one or two paragraphs explaining the current behavior, its impact, and representative code paths or reproduction details. Distinguish verified observations from reported symptoms and suspected causes. Resolution preferences or suggestions are optional; estimates and proposed fixes are not required.
- Keep a flat list of open problems. Contributors with available time can pick an entry, recheck the relevant code, and work on it. Remove resolved entries in the same change, or update an entry to describe what remains.

## Verification

- After TypeScript changes, run `npm run check:ts`; after SCSS changes, run `npm run check:css`.
- For import-order errors, try `npx eslint --fix <filename>`. If it fails, make one manual attempt, then report the remaining error. Suggest that command for unresolved auto-fixable ESLint errors.
- Keep additional verification proportional to the change. Once relevant checks pass, repeat or broaden them only for new changes, failures, or unresolved concerns.
- For browser verification, reuse `localhost:1234` if running; otherwise run `npm run dev`. If a sandboxed check fails, confirm through the browser or an approved check outside the sandbox before starting another server.
- Do not modify account state (send messages, change settings, etc.) unless directly prompted.

## Code conventions

- Functions and methods start with an imperative verb; `callback` is an exception. Use camelCase for acronyms (`parseJson`, `isUiReady`).
- Boolean names use `is`, `has`, `are` (for plurals), `should`, `can`, or `will`; the argument `force` is an exception.
- Optional boolean arguments and props default to `undefined`. Use a negative prop such as `noAvatar` for opt-out behavior. Preserve intentionally `undefined` or `false` prop values instead of adding defaults.
- Allowed abbreviations: `e` for events, `err` for errors, `cb` for callbacks; single-letter names are allowed in one-line lambdas.
- Hoist reused static constants to module scope with `UPPER_SNAKE_CASE`. Do not inline magic numbers inside functions, except 0 and 1.
- Prefer function declarations, except where arrow functions bind `this`; order functions by call hierarchy, with high-level functions first. Follow the component signature convention below for components.
- Prefer early returns. Check required arguments at the call site instead of making them optional solely to guard inside the callee.
- Cache a pure function's result when using it more than once in the same scope.
- When a value is guaranteed at runtime but TypeScript cannot infer it, use `!` instead of a guard that silently skips work. Avoid unnecessary `as` casts; prefer `satisfies` where appropriate.
- Use `undefined`, not `null`.
- Compare with server dates (message dates, expiries, `validUntil`) through `getServerTime()` from `src/util/serverTime.ts`, not `Date.now()`: the device clock can be off. Use `Date.now()` or `performance.now()` only for local durations.
- Avoid conditional object spreads: use `{ field: condition ? value : undefined }` so TypeScript checks the field against the target type.
- Comments explain complex logic. Start with a capital letter, wrap code entities in backticks, and omit the trailing period for single-sentence comments; punctuate each sentence in multi-sentence comments.
- Docs and comments assert current behavior in the present tense. Keep bug/change history and comparisons to prior code in Git history. Comparisons with hypothetical alternatives are fine when they explain the current design.

## Teact components

- Import built-in hooks from `src/lib/teact/teact.ts`; do not import `react`. React types are globally available in the `React` namespace.
- Type props on the component parameter instead of using `FC`. Migrate existing `FC` signatures in components you change.
- Use `OwnProps` for parent props and `StateProps` for `withGlobal` props; omit unused types. Put handlers and functions last in prop types.
- If used, `getActions()` is the first statement in the component. Call `useLang()` near the top.
- Prefer `useLastCallback` for stable callbacks with the latest scope. Use `useCallback` when a render function needs memoization.
- Prefer `useFlag` for simple toggles; use `useState` when setting a boolean from another variable. Avoid adding `useEffect` when existing hooks or direct callbacks suffice.
- Wrap components with `memo` when their props can remain stable. Skip wrappers with frequently changing `children` and primitives such as `ListItem`, `Button`, and `MenuItem`.
- Do not pass freshly allocated objects or arrays to memoized components. Use `useMemo` only for loops/expensive work or complex values passed to memoized children.
- Use the shared `Icon` component; available names are in `src/types/icons/index.ts`.

## Global state

- Prefer a component's existing `withGlobal`. If it is absent and a simple selector suffices, use `useSelector`. Use `getGlobal` only inside callbacks for one-off, non-reactive reads.
- Annotate `withGlobal`'s mapping function with `Complete<StateProps>` so every state prop is returned. Wrap connected components in `memo` when their props can remain stable.
- Selectors are pure and preserve object/array identity. Avoid loops and new objects or arrays in `withGlobal` mappings. For list computations, use `useShallowSelector` and perform the computation in `useMemo`.
- Put state selection/update logic longer than one line in the appropriate selector/reducer under `src/global/`.
- Update state through actions: return state from synchronous handlers or use `setGlobal`. Sync handlers return `ActionReturnType`; async handlers return `Promise<void>`. Actions under `src/global/actions/ui/` are synchronous.
- Update `src/global/types/actions.ts` when adding or removing an action.
- Pass `tabId` when calling an action or selector that accepts it. UI component calls may omit it because they receive it automatically.
- Store serializable data in global state: primitives and plain objects/arrays containing them, not class instances or functions.
- When adding a required `GlobalState` section, add its initialization to the `migrateCache` path in `src/global/cache.ts`. Changes to cached types need a migration; verify compatibility with state cached by the current `master` branch, including nested objects.

## Rendering and animation

Teact and Fasterdom separate DOM measurement from mutation. The frame order is effects, requested measures, JSX rendering, layout effects, requested mutations, then forced reflow measures/mutations.

| Context | Measure DOM | Mutate DOM |
| --- | --- | --- |
| `useLayoutEffect` | No | Yes |
| `useLayout` (deprecated) | Yes | No |
| Event handlers | Yes | Schedule with `requestMutation` |
| `requestMeasure` | Yes | No |
| `requestMutation` | No | Yes |

- For a measurement-dependent write, read inside `requestMeasure` and schedule the write with `requestMutation`. Use `requestForcedReflow` only as a last resort for synchronous measure/mutate work. See `src/lib/fasterdom/fasterdom.ts`.
- Prefer signals for frequent updates that do not need component renders, such as typing, caret position, and animation state. Signal setters notify subscribers without rendering; `useDerivedState` turns signal values into render state. Use `useStateRef` to read current state without adding dependencies.
- Reuse existing signal and scheduling hooks. `useSyncEffect` runs during render; `useLayoutEffectWithPrevDeps` runs in the layout-effect phase. Respect the corresponding DOM phase rules.
- Protect animation performance, especially in `Message`, `Chat`, and `Sticker`. Use `beginHeavyAnimation` to pause non-critical updates during heavy animations and `onFullyIdle` for work that can wait until animations and browser activity are idle.

## Styles

- Use camelCase classes in SCSS modules, import them as `styles`, and combine classes with `src/util/buildClassName.ts`.
- Add styles to the stylesheet already imported by the component. Extract styles to files; use inline styles only for values that need them.
- Teact's `style` prop accepts strings, not objects. Use a template literal for dynamic styles, e.g. ``style={`transform: translateX(${value}%)`}``.
- Prefer `rem` measurements (`N px = N / 16 rem`), with exceptions only when needed.
- Give each styled element a class. Avoid broad, complex, and tag-based selectors; nest only for meaningful relationships such as `.parentModifier .child`.
- Use existing font-weight variables, such as `var(--font-weight-medium)` and `var(--font-weight-semibold)`; never numeric weights, `bold`, or custom values.

## Localization

- Use `lang()` for all user-facing text. In components, get it from `useLang()`.
- Before adding a key, search existing translations and the [Translation Platform](https://translations.telegram.org/) for matching wording. Add new keys to `src/assets/localization/fallback.strings`, then run `npm run lang:ts`.
- Keys use PascalCase without dots, short context prefixes, and roughly fewer than 30 characters. Plurals need `_one` and `_other` forms.
- Replacements are the second argument; plural selection is an option in the third. Include replacements when the plural string has variables: `lang('PluralKey', { count }, { pluralValue: count })`.
- Use `{ withNodes: true }` for JSX replacements and add `withMarkdown: true` for Markdown. Reuse `lang.number`, `lang.region`, and conjunction/disjunction helpers where appropriate.
- Outside components, prefer translation objects supported by actions, such as `showNotification({ key: 'LangKey' })`, over calling `getTranslationFn()`.

## Settings search

- Settings are searchable only through `src/components/left/settings/search/registry.ts`. When adding, removing, renaming, or moving a settings screen or row, update the registry in the same change.
- A registry entry is located on its screen by the visible text of its `titleKey`, so use the lang key the screen renders. For a row whose text depends on state, add `data-settings-anchor="<titleKey>"` to its element.
- `tg://settings/<path>` links are mapped in `src/util/settingsLinks.ts`. Add a path only when native clients support it and it targets an existing screen or registry entry.

## Telegram API

- GramJS runs in a web worker; UI and global state use plain `Api*` objects from `src/api/types`.
- Read the TL schema in `src/lib/gramjs/tl/static/api.tl`; do not edit it. Add needed method names to `src/lib/gramjs/tl/static/api.json` and run `npm run gramjs:tl` to regenerate `src/lib/gramjs/tl/api.d.ts` and schema modules.
- Implement methods under `src/api/gramjs/methods/` using destructured parameter objects and `invokeRequest(new GramJs.namespace.MethodName(...))`. Name TL `get*` fetchers `fetch*`.
- Convert results using `apiBuilders` (`buildApi*`) and inputs using `gramjsBuilders` (`buildInput*`). Return `undefined` when `invokeRequest` returns `undefined`.
- Global actions call methods through `callApi` and check for `undefined` before updating state. Pass full `ApiPeer`, `ApiChat`, or `ApiUser` objects across this boundary; do not add separate `id`/`accessHash` method parameters. Extract fields for `buildInput*` inside the GramJS method.
- Server updates enter through `src/api/gramjs/updates/mtpUpdateHandler.ts` and merge through `src/global/actions/apiUpdaters/`; update types live in `src/api/types/updates.ts`.

## Commits and PRs

- Use `[Tag] Component / Area: Imperative description` for commit messages and PR titles. Capitalize the area and description's first word; omit trailing periods and semicolons.
- Optional tags: `[Refactoring]`, `[Perf]`, `[Size]`, `[Dev]`, `[SEO]`, `[CI]`, `[Security]`.
- Prefer plain text, with backticks for programmatic names. Separate multiple tasks with semicolons; start each sentence with a capital letter.
- Add `Closes #<issue_number>` to the PR description when addressing an issue.
