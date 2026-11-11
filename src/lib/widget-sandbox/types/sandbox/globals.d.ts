export declare let reportError: (e: unknown) => void;
export declare function configureLimits(limits: {
    maxTimers?: number;
}): void;
declare function clearTimer(id: any): void;
export declare function hostTimer(fn: () => void, ms: number): number;
export declare const clearHostTimer: typeof clearTimer;
export declare function fireTimer(id: number): void;
export declare const isHidden: () => boolean;
/** Returns true when the state changed (the caller dispatches `visibilitychange`). */
export declare function setHidden(h: boolean): boolean;
declare let frameHook: ((now: number) => ((run: () => void) => void) | null) | null;
export declare function setFrameHook(hook: typeof frameHook): void;
export declare function fireFrame(): void;
export declare const timeOrigin: () => number;
export declare class DOMException extends Error {
    constructor(message?: string, name?: string);
    get code(): number;
}
/** The client's preload (already checked by the glue); called once at boot. */
export declare function preloadStorage(storage: unknown): void;
/** The areas the task changed, in full, or null; the caller sends them to the glue (`__host('storage', …)`) once per task. */
export declare function takeStorageCommit(): Record<string, Record<string, string>> | null;
/** The client's UI language (checked by the glue; anything else is the default). */
export declare function setLocale(l: unknown): void;
/** Viewport or color scheme changed: re-evaluate media queries that have listeners. */
export declare function mediaChanged(): void;
export declare function fireResize(entries: {
    id: number;
    width: number;
    height: number;
}[], lookup: (id: number) => any): void;
export declare class NetworkDisabledError extends Error {
    constructor(api: string);
}
/**
 * The host's theme: at boot (`notify` false) and on every change. A change of the
 * scheme or of any colour gives the widget a fresh frozen `themeParams`, then
 * `themeChanged` and the legacy `onTheme` callbacks, in one task.
 */
export declare function setTheme(theme: unknown, notify: boolean): void;
/**
 * What the client draws over the widget (docs/sdk-v1.md §2.17): at boot (`notify` false) and on every change. A
 * change gives the widget a fresh frozen `contentSafeAreaInset`, then `contentSafeAreaChanged`, in one task (the
 * renderer has the root variables from the same call of the host).
 */
export declare function setContentSafeArea(area: unknown, notify: boolean): void;
/** Visibility changed (the caller has flipped `document.hidden`): `activated` / `deactivated`. */
export declare function fireActivation(): void;
/**
 * A link the widget did not open through the SDK (`<a href>`, `window.open`):
 * Telegram hosts go to openTelegramLink, others to openLink; what neither
 * accepts is ignored with a diagnostic, never an exception.
 */
export declare function followLink(href: unknown): void;
/**
 * The glue's context at boot (already decided there from the server's flags: a copy never has chatData, and has no
 * chatType or viewer unless it may request); checked again, the shim trusts nothing.
 */
export declare function configureWidget(config: Record<string, unknown>): void;
/** A `bridge` dispatch from the glue: the bot's data, or the answer to a request. */
export declare function bridgeEvent(event: unknown): void;
export interface WindowDeps {
    document: any;
    getComputedStyle: (el: any, pseudo?: string | null) => any;
    viewport: {
        innerWidth: number;
        innerHeight: number;
        dpr: number;
    };
}
export declare function setViewport(v: {
    innerWidth: number;
    innerHeight: number;
    dpr: number;
}): void;
export declare function installWindow(deps: WindowDeps): void;
export {};
