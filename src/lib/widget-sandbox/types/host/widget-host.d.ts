import { type ContentSafeArea, type ResizeAnchor, type StorageCommit, type WalletCall, type WidgetAction, type WidgetContext, type WidgetData, type WidgetRequest, type WidgetRequestAnswer, type WidgetTheme } from '../shared/sdk-policy';
import type { BubbleAction, Gesture, GestureClaim } from '../shared/gesture-policy';
import type { RendererFactory } from './renderer';
import type { WorkerPool } from './worker-pool';
import { type SandboxPolicy, type Stats } from '../shared/protocol';
export type { ChatType, ContentSafeArea, RequestFailure, SignDataPayload, WalletCall, WalletFailure, WalletMessage, WalletTransaction, WidgetAction, WidgetContext, WidgetData, WidgetRequest, WidgetRequestAnswer, WidgetTheme, WidgetUser, WidgetViewer, } from '../shared/sdk-policy';
export type { BubbleAction, Gesture, GestureClaim } from '../shared/gesture-policy';
/** A press the bubble took (`bubbleGestures`): what the bubble does with it, and where the pointer was, in widget coordinates. */
export interface BubbleGesture {
    action: BubbleAction;
    gesture: Gesture;
    x: number;
    y: number;
    /** Horizontal distance from pointerdown in physical coordinates, positive to the right */
    deltaX: number;
    /** It started in the leading edge strip, where the widget's claim does not apply. */
    edge: boolean;
    /** Menus use `start`; reply/back gestures commit on `end`, never on `cancel` */
    phase: 'start' | 'end' | 'cancel';
}
export interface WidgetHostOptions {
    /** The chat's theme (docs/sdk-v1.md §2.3, §2.4); a plain colour scheme is still accepted. */
    theme: 'light' | 'dark' | WidgetTheme;
    /** The client's UI language, BCP 47 (`navigator.language`, the Intl default); `en-US` when absent or malformed. */
    locale?: string;
    /**
     * What the client draws over the widget, in CSS px (docs/sdk-v1.md §2.17, §5.12): for a widget with no caption below it,
     * `bottom` = the height of the band the message time is drawn in over its bottom corner and `cornerRight` (or
     * `cornerLeft` in a right-to-left interface) = the width of that corner; omitted fields and a widget with a caption below
     * are 0. Pass it here, before the first render, so the first height already has the band; later only with the
     * bubble's layout (`setContentSafeArea`), never per frame. Out of range (insets 0–64, corners 0–200) is 0.
     */
    contentSafeArea?: Partial<ContentSafeArea>;
    /** Web Storage of this message as the client keeps it (docs/sdk-v1.md §5.4); over the quota it is dropped whole (`storage-rejected`). */
    storage?: StorageCommit;
    /** The bot's `chatData` and `publicData` as the message has them now (docs/sdk-v1.md §2.13); later edits go through `setData`. */
    data?: WidgetData;
    /**
     * The message's flags from the server (`isCopy`, `canQuery`, `backgroundQuery`), the chat type and the viewer
     * (docs/sdk-v1.md §4.4); fixed for the host's life. Without `canQuery` every request is refused.
     */
    context?: WidgetContext;
    /**
     * A request the widget sends to the bot (`TelegramWidget.request`, checked: the data, the server's flags, the press
     * or the background rules, one in flight). The client sends `data` like a callback button's press and resolves
     * with the server's answer, `{ result }`, or rejects with `'TIMEOUT'`, `'RATE_LIMITED'` or `'FAILED'`. Without it
     * every request is refused (`NOT_ALLOWED`). `request.wallet`: attach the user's wallet card (`with_wallet`).
     */
    onRequest?: (request: WidgetRequest) => Promise<WidgetRequestAnswer> | WidgetRequestAnswer;
    /**
     * A wallet call (`TelegramWidget.wallet`, docs/sdk-v1.md §2.18; checked: the transaction or the payload, a press or
     * the grant, one call in flight with the requests). The client shows its own wallet window with the bot of the
     * message; on confirmation it sends the transaction (or signs for `bot<bot_id>`), sends the outcome to the bot as a
     * query with `call.data` and resolves with the bot's answer, `{ result }`. It rejects with `'REJECTED'` (the user
     * declined), `'BAD_REQUEST'` (the wallet refused it) or a request's failure. Only with `context.wallet`; without it
     * every call is refused (`NOT_ALLOWED`).
     */
    onWallet?: (call: WalletCall) => Promise<WidgetRequestAnswer> | WidgetRequestAnswer;
    /** Copy this text to the clipboard and show a toast that says what was copied (`TelegramWidget.copyText`, checked, one per press). */
    onCopyText?: (text: string) => void;
    memoryLimitBytes?: number;
    cpuLimitMs?: number;
    cpuQuotaMs?: number;
    cpuQuotaWindowMs?: number;
    cpuKillAfterMs?: number;
    /** The host's main-thread work for this widget per window (layout queries + 25 µs per op + 2 µs per canvas command); default 100 ms. */
    mainThreadQuotaMs?: number;
    maxTimers?: number;
    policy?: SandboxPolicy;
    /** Initial visibility; change it later with `setVisible`. */
    visible?: boolean;
    /** Protected chat content cannot be selected or copied inside the widget */
    isProtected?: boolean;
    /** The client's answer to `prefers-reduced-motion`, for the widget's CSS and matchMedia (local patch, NOTICE.md) */
    reducedMotion?: boolean;
    /**
     * A finger's tap keeps the client's composer focused, also over selectable widget text; a mouse press on that text
     * still takes the focus, which selecting needs
     */
    shouldKeepFocus?: boolean;
    onLog?: (level: string, text: string) => void;
    onDiag?: (kind: string, detail: string) => void;
    onStats?: (stats: Stats & {
        nodes: number;
    }) => void;
    /** What the widget asked the client to do, checked (URL rules, user activation, the haptic rate limit). */
    onAction?: (action: WidgetAction) => void;
    /** The new full content of a Web Storage area, at the end of each task that changed it. */
    onStorageCommit?: (area: 'local' | 'session', values: Record<string, string>) => void;
    /**
     * On every primary pointerdown: what of this press the widget claims with `touch-action` (gesture-policy.ts):
     * horizontal drags (`x`) and holds (`hold`, no message menu). Taps and double taps are always its own, vertical
     * drags always the chat's (`y` is always false since v0.1.3).
     */
    onGestureClaim?: (claim: GestureClaim) => void;
    /**
     * The renderer plays the bubble (docs/sdk-v1.md §5.5): presses the widget does not claim are the bubble's, and the
     * widget gets `pointercancel` when the bubble takes one (`onBubbleGesture`). For a client with no recognizers of its
     * own over the widget (the web client, the dev app). `touch`: a mouse's primary button arbitrates as a finger, so a
     * desktop browser reproduces a phone; `rtl`: the leading edge strip is on the right.
     */
    bubbleGestures?: boolean | {
        touch?: boolean;
        rtl?: boolean;
    };
    /** With `bubbleGestures`: the bubble took a press (the message menu, swipe-to-reply or back, the list scroll). */
    onBubbleGesture?: (gesture: BubbleGesture) => void;
    /** @deprecated since v1: `onAction`. The raw method and arguments of each call `onAction` gets. */
    onBridge?: (method: string, args: unknown[]) => void;
    /** Fatal: the runtime is gone. The renderer keeps the last state (frozen); call `destroy()` to remove it. */
    onDead?: (reason: string) => void;
    /** Non-fatal uncaught exception in widget code (also in the log); for showing an error line under the bubble. */
    onError?: (text: string) => void;
    /** Badge text shown by the renderer over a dead widget (user-facing, no error details). */
    stoppedLabel?: string;
    onLoaded?: () => void;
    /**
     * The bubble's height (the content's, clamped to [50, 600]) on every size report, and the edge of the bubble that
     * stays put on screen when it changes (`TelegramWidget.setResizeAnchor`, docs/sdk-v1.md §2.12 and §5.6): `top` (the
     * default: the content below moves) or `bottom` (the content above moves).
     */
    onResize?: (height: number, anchor: ResizeAnchor) => void;
    /**
     * The widget started (`true`) or stopped (`false`) watching its shared `public_data`
     * (`TelegramWidget.watchPublicData`, docs/sdk-v1.md §2.13): poll `getWidgetPublicData` for it only while it watches
     * and is on screen, and only when the message has a `widget_id`. Called on a change only; `watchesPublicData` has
     * the latest.
     */
    onWatchPublicData?: (on: boolean) => void;
    /** The renderer; the Shadow DOM renderer when omitted. */
    rendererFactory?: RendererFactory;
    /** Take the sandbox worker from a pool of warmed ones (worker-pool.ts) instead of booting a fresh one. */
    workerPool?: WorkerPool;
    /**
     * Opt-in sandbox features (docs/protocol.md, "Features"). The web runtime honours
     * `webAnimations`, `noInPlaceText`, `noAttrFast` and `noCanvasRect` (`WEB_FEATURES` in
     * worker.ts); the native-only wire forms (`canvasWords`, `binaryOps`, `morphUpdates`) are dropped.
     */
    features?: string[];
}
export declare class WidgetHost {
    private opts;
    /** The renderer's element in the bubble (an iframe for the product renderer, a canvas for Blitz). */
    readonly element: HTMLElement;
    /** The product renderer's frame; null for other renderers (Playwright suites look inside it). */
    get iframe(): HTMLIFrameElement | null;
    /** The edge of the bubble that stays put when the widget's height changes: the widget's latest `setResizeAnchor`, `top` until then. */
    get resizeAnchor(): ResizeAnchor;
    /** Whether the widget watches its shared `public_data` (its latest `watchPublicData` / `unwatchPublicData`), false until then. */
    get watchesPublicData(): boolean;
    /** What the client draws over the widget as the widget sees it (checked: `contentSafeArea`, `setContentSafeArea`). */
    get contentSafeArea(): ContentSafeArea;
    private worker;
    private renderer;
    private validator;
    /** The worker waits for the answer to its layout query (local patch, NOTICE.md: an answer is a message, not a SAB). */
    private awaitingAnswer;
    /** This thread's time on the widget's messages, not yet reported to the worker. */
    private hostWorkMs;
    private hostWorkTimer;
    private querySeq;
    private qid;
    private pendingQuery;
    private destroyed;
    private dead;
    private viewport;
    private theme;
    private widgetTheme;
    private safeArea;
    private visible;
    private policy;
    private gestures;
    private activation;
    private blockedBridgeReported;
    private rejectedBridgeReported;
    private rejectedStorageReported;
    private haptics;
    private anchor;
    private hasBubbleGestures;
    private watching;
    private context;
    private previewBlockedReported;
    private requests;
    /** A background request the widget made off screen: it goes to the client when the widget appears (`setVisible`). */
    private heldRequest;
    private blockedRequestsReported;
    constructor(container: HTMLElement, html: string, opts: WidgetHostOptions);
    setTheme(theme: 'light' | 'dark' | WidgetTheme): void;
    /**
     * What the client draws over the widget changed with the bubble's layout (docs/sdk-v1.md §2.17, §5.12): a caption
     * added or removed by an edit, an "edited" mark that widens the time. The renderer gets the root variables and the
     * widget `contentSafeAreaInset` and `contentSafeAreaChanged`, from the same call; never per frame.
     */
    setContentSafeArea(area: Partial<ContentSafeArea>): void;
    /** Turns the renderer's bubble on or off (`WidgetHostOptions.bubbleGestures`); a preview takes no input at all. */
    setBubbleGestures(mode: boolean | {
        touch?: boolean;
        rtl?: boolean;
    }): void;
    setProtected(isProtected: boolean): void;
    setKeepFocus(shouldKeepFocus: boolean): void;
    /**
     * The bot's data changed (`updateMessageWidgetData`, or a new `public_data` from polling the shared object): the
     * full state of both strings. The widget gets `chatDataChanged` / `publicDataChanged` for each that differs; a copy
     * keeps no `chatData`, only its `publicData` changes.
     */
    setData(data: WidgetData): void;
    /** The viewer as the widget sees it; a field that breaks its rule is left out and reported (`data-rejected`). */
    private checkViewer;
    private checkData;
    /**
     * docs/sdk-v1.md §2.14: a press unlocks one request, background ones only where the context allows them; one in
     * flight. The gate decides first; one made off screen waits here for the widget to appear (`held`); a client
     * without `onRequest` refuses at delivery, as the native hosts do.
     */
    private request;
    /**
     * docs/sdk-v1.md §2.18: a wallet call goes out on a press or on the grant (the answer to a call made by a press,
     * within 10 s), never in the background; one call in flight with the requests.
     */
    private walletCall;
    private answerRequest;
    private refuseRequest;
    /** A request the gate let through, to the client; its answer or failure frees the gate. */
    private deliverRequest;
    /** The client's outcome of a request or a wallet call into the widget; it frees the gate, and an answer brings the grant when the call had a press or the grant. */
    private settle;
    /** The widget stopped (dead or destroyed): a held request never reaches the client. */
    private dropHeldRequest;
    private preload;
    /**
     * The host knows whether the bubble is on screen; the sandbox does not.
     * Hidden: no animation frames, timers at 1 Hz, `document.hidden` /
     * `visibilitychange` inside the widget. Visible again: deferred timers fire,
     * one frame is requested if the widget asked for one meanwhile.
     */
    setVisible(visible: boolean): void;
    /**
     * Ends the runtime and keeps its last render as a still picture with no badge (local patch, NOTICE.md): the worker
     * is freed, and the owner starts a new host when the widget is wanted again, then destroys
     * this one. Not a crash: `onDead` is not called.
     */
    suspend(): void;
    destroy(): void;
    private toWorker;
    private toRenderer;
    private die;
    /**
     * The model of the main-thread window charges an op 25 µs, while one that changes a 32 KB stylesheet costs this thread
     * milliseconds: the time is measured and the worker charges it (local patch, NOTICE.md).
     */
    private onWorker;
    private handleWorker;
    /** Sends a query answer to the worker, whose widget code waits for it (local patch, NOTICE.md). */
    private answerQuery;
    private onRenderer;
}
