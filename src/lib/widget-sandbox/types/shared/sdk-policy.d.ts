export declare const MAX_LINK_LENGTH = 256;
/** Bytes of keys and values (UTF-8) per storage area and message (4 KB: a 50-item to-do list; docs/decisions.md, "Strict limits from the start"). */
export declare const STORAGE_QUOTA_BYTES = 4096;
export declare const MAX_LOCALE_LENGTH = 35;
export declare const DEFAULT_LOCALE = "en-US";
export declare const HAPTIC_BURST = 5;
export declare const HAPTIC_PER_SECOND = 10;
/** `haptic-limit` is reported at most this often. */
export declare const HAPTIC_REPORT_MS = 1000;
/** Haptics are free (under the rate limit) while a finger or a mouse button is down on the widget and this long after it is lifted. */
export declare const HAPTIC_TOUCH_WINDOW_MS = 5000;
/** Outside a touch, the first haptic opens a series: the calls of its first second pass (under the rate limit), later ones are dropped. */
export declare const HAPTIC_SERIES_MS = 1000;
/** Without a touch since the last series, the next one may start this long after the last one began. */
export declare const HAPTIC_SERIES_GAP_MS = 10000;
/** A press whose end the host never saw (the finger left the view) counts as lifted this long after it began. */
export declare const HAPTIC_PRESS_MAX_MS = 30000;
/** Handlers per `onEvent` type (and for the legacy `onTheme`); more are ignored. */
export declare const MAX_HANDLERS_PER_EVENT = 16;
export declare const THEME_KEYS: readonly ["bg_color", "text_color", "hint_color", "link_color", "button_color", "button_text_color", "secondary_bg_color", "accent_text_color", "subtitle_text_color", "destructive_text_color", "section_bg_color", "section_header_text_color", "section_separator_color", "header_bg_color", "bottom_bar_bg_color"];
export type ThemeKey = (typeof THEME_KEYS)[number];
export type ThemeParams = Record<ThemeKey, string>;
export declare const HAPTIC_IMPACT_STYLES: string[];
export declare const HAPTIC_NOTIFICATION_TYPES: string[];
export declare const TELEGRAM_HOSTS: string[];
/** The edge of the bubble that stays put on screen when the widget's height changes (`setResizeAnchor`, docs/sdk-v1.md §2.12). */
export type ResizeAnchor = 'top' | 'bottom';
export declare const RESIZE_ANCHORS: readonly ResizeAnchor[];
/** Until the widget calls `setResizeAnchor`: the bubble grows and shrinks downward. */
export declare const DEFAULT_RESIZE_ANCHOR: ResizeAnchor;
/** UTF-8 bytes of `chatData` and of `publicData` each (the server's limit, `chat_data` / `public_data`). */
export declare const MAX_WIDGET_DATA_BYTES = 1024;
/** UTF-8 bytes of a request's `data` (as `callback_data`). */
export declare const MAX_REQUEST_DATA_BYTES = 64;
/** UTF-8 bytes of an answer's `result`. */
export declare const MAX_REQUEST_RESULT_BYTES = 1024;
/** UTF-16 code units of a `copyText` text (as the `copy_text` button's). */
export declare const MAX_COPY_TEXT_LENGTH = 256;
/** A background request (not from a press): one when the widget appears on screen, then at most one per this long while it stays visible. */
export declare const BACKGROUND_REQUEST_INTERVAL_MS = 5000;
/** The request ids the shim numbers its calls with. */
export declare const MAX_REQUEST_ID = 2147483647;
/** A Telegram user id fits in 53 bits: a JS number holds it exactly. */
export declare const MAX_VIEWER_ID = 9007199254740991;
/** UTF-16 code units of the viewer's first and last name (each 1 to this). */
export declare const MAX_VIEWER_NAME_LENGTH = 64;
/** The viewer's username: 5–32 characters of A–Z, a–z, 0–9 and _. */
export declare const VIEWER_USERNAME: RegExp;
/** The chat kinds a host may report (`Chat.type` of the Bot API); a value outside them is no chat type (null). */
export declare const CHAT_TYPES: readonly ["private", "group", "supergroup", "channel"];
export type ChatType = (typeof CHAT_TYPES)[number];
/**
 * What a refused or failed request rejects with in the widget (`error.code`); `REJECTED` and `BAD_REQUEST` only for
 * a wallet call: the user declined in the client's window, the wallet refused the transaction or the payload.
 */
export declare const REQUEST_ERRORS: readonly ["NOT_ALLOWED", "BUSY", "RATE_LIMITED", "TIMEOUT", "FAILED", "INVALID_ANSWER", "REJECTED", "BAD_REQUEST"];
export type RequestError = (typeof REQUEST_ERRORS)[number];
/** What a client reports for a request it could not complete: the bot did not answer in time, flood wait, anything else. */
export type RequestFailure = 'TIMEOUT' | 'RATE_LIMITED' | 'FAILED';
/** What a client reports for a wallet call it could not complete: a request's failures, the user's refusal, the wallet's. */
export type WalletFailure = RequestFailure | 'REJECTED' | 'BAD_REQUEST';
export type LinkMethod = 'openLink' | 'openTelegramLink';
export type HapticCall = {
    haptic: 'impact' | 'notification' | 'selection';
    value?: string;
};
export type WidgetAction = {
    kind: 'ready';
} | {
    kind: 'openLink';
    url: string;
} | {
    kind: 'openTelegramLink';
    url: string;
} | ({
    kind: 'haptic';
} & HapticCall);
/**
 * A bridge call that passed its checks: an action for the client (`onAction`); the resize anchor, which no action
 * carries (the host keeps the latest one next to the height it reports); whether the widget watches its shared
 * `public_data` (the host keeps the latest, the client polls only for widgets that watch); a request to the bot (the
 * request gate, then the client's `onRequest`; `wallet`: the widget asks the server to attach the user's wallet); a
 * wallet call (the request gate, then the client's `onWallet`); a text to copy (`onCopyText`).
 */
export type BridgeCall = WidgetAction | {
    kind: 'setResizeAnchor';
    edge: ResizeAnchor;
} | {
    kind: 'watchPublicData';
    on: boolean;
} | {
    kind: 'request';
    id: number;
    data: string;
    wallet?: true;
} | {
    kind: 'wallet';
    id: number;
    call: WalletCall;
} | {
    kind: 'copyText';
    text: string;
};
/** Methods that need the task's user gesture (docs/protocol.md, "User activation"); one press unlocks one of them. `request` has its own gate (`RequestGate`). */
export declare const PRIVILEGED_METHODS: Set<string>;
/**
 * The bridge methods a preview (an inline result before it is sent: `WidgetContext.preview`) may call; everything
 * else is refused there: no request, link, copy or haptic. A preview gets no input either (its host drops the
 * renderer's events and gesture claims).
 */
export declare const PREVIEW_METHODS: ReadonlySet<string>;
export declare function allowedInPreview(method: unknown): boolean;
/** UTF-8 length of a JS string; a lone surrogate counts 3 bytes (what U+FFFD takes). */
export declare function utf8Length(s: string): number;
/**
 * The URL a link call opens, or null when it breaks the rules: an absolute
 * `https:` URL, no user name or password, an ASCII host of LDH labels (an IDN in
 * its `xn--` form), an optional port, at most 256 characters once non-ASCII
 * characters after the host are percent-encoded as UTF-8. `openTelegramLink`
 * takes only t.me, telegram.me and telegram.dog (and their subdomains), any
 * path; `openLink` takes every other host. Scheme and host come out lowercase,
 * the rest as given.
 */
export declare function checkLink(method: LinkMethod, url: unknown): string | null;
/** The haptic of a `haptic` bridge call's args, or null: `['impact', style]`, `['notification', type]`, `['selection']`. */
export declare function checkHaptic(args: unknown): HapticCall | null;
/** The resize anchor of a `setResizeAnchor` call's argument, or null: exactly `'top'` or `'bottom'`. */
export declare function checkResizeAnchor(edge: unknown): ResizeAnchor | null;
/** The action of a bridge call, or null when the method is unknown or its arguments are wrong (`bridge-rejected`). */
export declare function checkBridgeCall(method: unknown, args: unknown): BridgeCall | null;
/** A request's `data`, or null: a well-formed string of 1–64 UTF-8 bytes. */
export declare function checkRequestData(data: unknown): string | null;
/** A `request`'s options, or null: an object with at most `wallet`, a boolean (absent or null: false). */
export declare function checkRequestOptions(options: unknown): {
    wallet: boolean;
} | null;
/** A `copyText` text, or null: a well-formed string of 1–256 UTF-16 code units. */
export declare function checkCopyText(text: unknown): string | null;
/**
 * One of `chatData` / `publicData`: a well-formed string of 1–1024 UTF-8 bytes without a NUL (the server's rule for
 * its text fields); null for none (null, absent, the empty string the bot clears it with) and for anything else.
 */
export declare function checkWidgetDataValue(value: unknown): string | null;
/** The bot's data as the widget sees it, and the fields the client passed that broke the rules (the glue reports `data-rejected`). */
export interface CheckedWidgetData {
    chatData: string | null;
    publicData: string | null;
    rejected: ('chatData' | 'publicData')[];
}
/**
 * The full state of the bot's two strings, as the client passes it at creation and in `setData`. A forwarded copy
 * has no `chatData` (the server never copies it): the glue drops what the client passed, silently.
 */
export declare function checkWidgetData(data: unknown, copy: boolean): CheckedWidgetData;
/**
 * Who looks at the widget, as the widget sees it (Mini Apps' `WebAppUser`): `id`, `first_name`, `last_name`,
 * `username`, `is_premium`. The input has the same field names. No viewer (null) without a positive integer id of at
 * most 53 bits; a field that breaks its rule is left out and listed in `rejected` (in this order): a name 1–64 UTF-16
 * code units without a lone surrogate, a username 5–32 characters of A–Z, a–z, 0–9 and _, `is_premium` a boolean,
 * kept only when true. Absent (undefined or null) fields are left out without a word.
 */
export declare function checkViewer(viewer: unknown): {
    viewer: WidgetUser | null;
    rejected: string[];
};
/** Why a viewer field was left out (`data-rejected`: `viewer.<field>: <why>; the widget does not see it`). */
export declare const VIEWER_FIELD_RULES: Record<string, string>;
/** The account that looks at the widget, as the client passes it (docs/sdk-v1.md §4): its id and, when it has them, its names, username and Premium. */
export interface WidgetViewer {
    id: number;
    firstName?: string;
    lastName?: string;
    username?: string;
    isPremium?: boolean;
}
/** The viewer as the widget sees it (`TelegramWidget.viewer`, the shape of Mini Apps' `WebAppUser`); `is_premium` only when true. */
export interface WidgetUser {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    is_premium?: true;
}
/** A client's `WidgetViewer` in the widget's field names, for `checkViewer`. */
export declare function viewerUser(viewer: WidgetViewer | null | undefined): Record<string, unknown> | null;
export declare function checkChatType(chatType: unknown): ChatType | null;
/**
 * The bot's answer to a request as the widget gets it: `result`, a well-formed string of at most 1024 UTF-8 bytes
 * without a NUL (empty allowed), or none. Null when it breaks the rules (the widget gets `INVALID_ANSWER`). An
 * answer carries no data: the bot edits its data with separate calls, which reach the host as `setData`.
 */
export declare function checkRequestAnswer(answer: unknown): {
    result: string | null;
} | null;
/** The bot's two strings as the client has them for this message (absent = none); the full state each time. */
export interface WidgetData {
    chatData?: string | null;
    publicData?: string | null;
}
/**
 * Where the widget is and what it may do, from the message (`messageMediaWidget`'s flags) and the chat; fixed for the
 * host's life. The server computes the flags; the framework derives nothing itself (docs/sdk-v1.md §2.14).
 */
export interface WidgetContext {
    /** `is_copy`: the message is a forwarded copy: never any chatData. */
    isCopy?: boolean;
    /** `can_query`: requests are allowed, on a tap. */
    canQuery?: boolean;
    /** `background_query`: requests without a tap too (the original in the private chat with the bot): one when the widget appears on screen, then one per 5 s while visible; one made off screen waits for it to appear. */
    backgroundQuery?: boolean;
    /**
     * The client has Gram Wallet for this user: it supports the wallet and the wallet is available in the user's country
     * (docs/sdk-v1.md §2.18). The widget gets `TelegramWidget.wallet` only with `canQuery` too, never in a preview.
     */
    wallet?: boolean;
    /** The kind of chat the message is in. A copy gets none (null in the widget): the bot must not learn where its widget was forwarded. */
    chatType?: ChatType;
    /** The account that looks at the widget. Only a widget with `canQuery` gets it (null elsewhere, previews included). */
    viewer?: WidgetViewer;
    /**
     * An inline result shown before it is sent (no message yet): the widget gets its data and runs as usual, but no
     * input, no requests or other bridge calls but `ready` / `setResizeAnchor`, no chat type or viewer, and Web
     * Storage that is never committed. The request flags are ignored.
     */
    preview?: boolean;
}
/**
 * What the client sends to the bot: `data` (1–64 bytes). Whether it came from a tap stays in the framework: the server and the bot cannot tell.
 * `wallet`: the widget asked for the user's wallet (only on a tap): the client asks the server to attach the wallet card (`with_wallet`).
 */
export interface WidgetRequest {
    data: string;
    wallet?: boolean;
}
/** The bot's answer as the client hands it to the host: the server's `result` (at most 1024 bytes; absent: an empty answer). */
export interface WidgetRequestAnswer {
    result?: string | null;
}
/** What a client's failed request becomes in the widget: `'TIMEOUT'`, `'RATE_LIMITED'`, `'FAILED'`, or `{ code }` with one of them; anything else is `FAILED`. */
export declare function requestFailure(reason: unknown): RequestFailure;
/** What a client's failed wallet call becomes in the widget: a request's failures, `'REJECTED'`, `'BAD_REQUEST'` (or `{ code }`); anything else is `FAILED`. */
export declare function walletFailure(reason: unknown): WalletFailure;
/** Messages in one transaction: what Gram Wallet takes (its TON Connect `maxMessages`). */
export declare const MAX_WALLET_MESSAGES = 255;
/** Characters of a message's `payload` or `stateInit` (a bag of cells in base64). */
export declare const MAX_WALLET_BOC_LENGTH = 8192;
/** Characters of every message's `payload` and `stateInit` together. */
export declare const MAX_WALLET_BOC_TOTAL = 65536;
/** UTF-8 bytes of a `signData` text; characters of its `bytes` or `cell` (base64). */
export declare const MAX_SIGN_DATA_LENGTH = 4096;
/** UTF-8 bytes of a `cell` payload's TL-B schema. */
export declare const MAX_SIGN_DATA_SCHEMA_BYTES = 1024;
/** After the answer to a call made by a tap (a request or a wallet call) reached the widget, one wallet call may follow without a new tap this long. */
export declare const WALLET_GRANT_MS = 10000;
/** TON Connect's network ids: the mainnet and the testnet. */
export declare const WALLET_NETWORKS: string[];
/** One message of a transaction, as TON Connect's `sendTransaction` has it: the destination, nanotons as a decimal string, a body and a `StateInit` in base64. */
export interface WalletMessage {
    address: string;
    amount: string;
    payload?: string;
    stateInit?: string;
}
/** A transaction as TON Connect's `sendTransaction` request has it (its field names); the client hands it to its TON Connect window as is. */
export interface WalletTransaction {
    valid_until?: number;
    network?: string;
    from?: string;
    messages: WalletMessage[];
}
/** A `signData` payload as TON Connect has it: a text, bytes, or a cell with its TL-B schema. The client sets the domain (`bot<bot_id>`), never the widget. */
export interface SignDataPayload {
    type: 'text' | 'binary' | 'cell';
    text?: string;
    bytes?: string;
    schema?: string;
    cell?: string;
    network?: string;
    from?: string;
}
/** A wallet call that passed its checks; `data` (1–64 bytes) goes to the bot with the call's outcome, as a request's. */
export type WalletCall = {
    method: 'sendTransaction';
    transaction: WalletTransaction;
    data: string;
} | {
    method: 'signData';
    payload: SignDataPayload;
    data: string;
};
/** A TON address, or null: raw (`0:` or `-1:` and 64 hex digits) or user-friendly (48 characters of base64 or base64url); a transaction's `from`. The wallet checks the rest. */
export declare function checkWalletAddress(address: unknown): string | null;
/** A message's destination, or null: user-friendly only (TON Connect: the wallet must refuse a raw one; the bounce flag is in it). */
export declare function checkWalletDestination(address: unknown): string | null;
/**
 * A transaction for `sendTransaction`, or null: TON Connect's fields only (`valid_until`, `network`, `from`,
 * `messages`), 1–255 messages of `address`, `amount` and optionally `payload` and `stateInit`. `valid_until` an
 * integer of 1 to 2^32 − 1 (Unix seconds), `network` `-239` or `-3`, `from` raw or user-friendly, a message's
 * `address` user-friendly only, amounts decimal strings of nanotons (at most 37 digits, no leading zero), payloads
 * base64 of at most 8192 characters each and 65536 together. Absent and null fields are left out. The wallet checks
 * the rest (the network and the sender against the account, the cells, the expiry) and refuses with `BAD_REQUEST`.
 */
export declare function checkWalletTransaction(tx: unknown): WalletTransaction | null;
/**
 * A `signData` payload, or null: TON Connect's three kinds with their fields only, and optionally `network` and
 * `from` as a transaction's. `text`: 1–4096 UTF-8 bytes; `binary`: `bytes`, base64 of at most 4096 characters;
 * `cell`: `schema` (TL-B, 1–1024 UTF-8 bytes) and `cell`, base64 of at most 4096 characters. Absent and null fields
 * are left out. No domain: the client signs for the bot of the message (`bot<bot_id>`).
 */
export declare function checkSignDataPayload(payload: unknown): SignDataPayload | null;
/**
 * The verdict on a request (docs/sdk-v1.md §2.14): `foreground` (it consumes the task's press) and `background`
 * go to the client; `held` (a background request from a widget off screen) waits in the glue and goes to the client
 * when the widget appears on screen (`RequestGate.show`); the rest are refused: `disabled` (no `canQuery`: a widget
 * sent without `allow_queries`, or a forwarded copy of one sent without `fwd_allow_queries`), `busy` (one request in
 * flight per widget, a held one included), `no-activation` (no press, and no `backgroundQuery`), `rate-limited` (a
 * background request sooner than 5 s after the last one, unless the widget appeared on screen since). A wallet call
 * (`decideWallet`), or a request that asks for the wallet, goes out only as `foreground` or `granted` (no press, but
 * within 10 s of the answer to a call made by a tap); `no-wallet` when the client has no wallet for this user.
 */
export type RequestVerdict = 'foreground' | 'background' | 'held' | 'granted' | 'disabled' | 'no-wallet' | 'busy' | 'no-activation' | 'rate-limited';
/** What the widget's promise rejects with for a refused request. */
export declare function requestRefusal(verdict: RequestVerdict): RequestError | null;
/**
 * The client's sandbox policy for requests, from the server's flags only: on a tap whenever `canQuery`; without one
 * only with `backgroundQuery`: one when the widget appears on screen (`show`, and at creation), then at most one per
 * 5 s counted from the start of the last background request, while it stays visible; one made while it is off screen
 * is held (`held`) and is the one of its next appearance (`show` returns true: the glue sends it then). One request
 * in flight, a held one included. `gesture`: the task has a press no privileged call consumed yet (the glue consumes
 * it on `foreground`). `finish` when the answer or the failure has gone into the widget, or when the glue drops a
 * held request (the widget stopped); `answeredAt` when an answer with no error went in then.
 *
 * The wallet (docs/sdk-v1.md §2.18): only with `wallet` (the client has Gram Wallet for this user). A request that
 * asks for the wallet (`withWallet`) and a wallet call (`decideWallet`) need the visible widget and a press, or the
 * grant: the answer to the last call made by a press or a grant (a request or a wallet call) lets one wallet call
 * follow within 10 s, so a tap can pay for what the bot answers (tap → request → transaction). Any call that goes
 * out as `foreground` or `granted` uses up the grant; its answer brings the next one.
 */
export declare class RequestGate {
    private inFlight;
    private held;
    private lastBackground;
    /** The call in flight went out on a press or the grant: its answer grants one wallet call. */
    private granting;
    private grantAt;
    get busy(): boolean;
    decide(now: number, s: {
        gesture: boolean;
        visible: boolean;
        canQuery: boolean;
        backgroundQuery: boolean;
        withWallet?: boolean;
        wallet?: boolean;
    }): RequestVerdict;
    /** A wallet call (`sendTransaction`, `signData`): on a press, or on the grant within 10 s of its answer. */
    decideWallet(now: number, s: {
        gesture: boolean;
        visible: boolean;
        canQuery: boolean;
        wallet: boolean;
    }): RequestVerdict;
    private out;
    finish(answeredAt?: number): void;
    /**
     * The widget appeared on screen (it was hidden): its next background request may go out at once. True when a held
     * request goes out now, as this appearance's background request (the glue sends it; it stays in flight).
     */
    show(now: number): boolean;
}
/**
 * Haptics need a visible widget and room in the bucket (5 calls, refilled at 10 per second), and a touch: while a
 * finger is down on the widget and for 5 s after it is lifted they are free (under the rate limit); outside that, the
 * first call opens a series whose first second passes, then nothing until the next touch, or 10 s after the series
 * began when there was none (docs/sdk-v1.md §2.6; a widget cannot buzz the phone from a timer). `press` / `release`
 * are the host's trusted presses (the renderer's claim at a primary pointerdown and its release), never the widget's
 * events. `play` delivers; `drop` drops silently; `report` drops and reports `haptic-limit` (at most once per second).
 */
export declare class HapticGate {
    private tokens;
    private last;
    private reported;
    /** A press is on since then. */
    private down;
    /** The last press ended then. */
    private lifted;
    /** The last series (haptics outside a touch) began then. */
    private series;
    /** A finger or a mouse button went down on the widget (trusted input only). */
    press(now: number): void;
    /** The press ended: the finger was lifted or the press was cancelled. */
    release(now: number): void;
    decide(now: number, visible: boolean): 'play' | 'drop' | 'report';
}
/** The theme keys of `params` whose values are `#rrggbb` (lowercased); everything else is dropped. */
export declare function checkThemeParams(params: unknown): Partial<ThemeParams>;
/** A BCP 47 tag of at most 35 characters (`ru`, `en-US`, `pt-BR`, `zh-Hant-TW`), or null. */
export declare function checkLocale(locale: unknown): string | null;
/** UTF-8 bytes of an area's keys and values. */
export declare function storageBytes(area: Record<string, string>): number;
/** An object of strings within the quota, or null. */
export declare function checkStorageArea(area: unknown): Record<string, string> | null;
export type StorageCommit = {
    local?: Record<string, string>;
    session?: Record<string, string>;
};
/** A commit (or a preload) of `local` and/or `session`, each checked whole; null when anything is wrong (`storage-rejected`). */
export declare function checkStorageCommit(commit: unknown): StorageCommit | null;
/**
 * The server's flags for each kind of widget message (the server's matrix, docs/tgw-format.md "Who may request"; the
 * originals and live copies of a widget sent with `allow_queries`): what a client passes as `WidgetContext` for it. Dev tooling only: a client reads the flags from the message.
 */
export declare const WIDGET_MESSAGE_KINDS: {
    /** The original in the private chat with the bot that sent it. */
    readonly private: {
        readonly isCopy: false;
        readonly canQuery: true;
        readonly backgroundQuery: true;
        readonly chatType: "private";
    };
    /** An original the bot sent to a group (or a supergroup) it is a member of. */
    readonly group: {
        readonly isCopy: false;
        readonly canQuery: true;
        readonly backgroundQuery: false;
        readonly chatType: "group";
    };
    /** An original sent via the bot (inline mode), here in a private chat between two users. */
    readonly 'via-bot': {
        readonly isCopy: false;
        readonly canQuery: true;
        readonly backgroundQuery: false;
        readonly chatType: "private";
    };
    /** An original the bot sent without `allow_queries` (here in its private chat): no requests anywhere, no network marker. */
    readonly 'no-queries': {
        readonly isCopy: false;
        readonly canQuery: false;
        readonly backgroundQuery: false;
        readonly chatType: "private";
    };
    /** A forwarded copy of a widget the bot sent with `fwd_allow_queries` (and so `allow_queries`). */
    readonly 'live-copy': {
        readonly isCopy: true;
        readonly canQuery: true;
        readonly backgroundQuery: false;
        readonly chatType: "private";
    };
    /** A forwarded copy of a widget sent without `fwd_allow_queries`. */
    readonly copy: {
        readonly isCopy: true;
        readonly canQuery: false;
        readonly backgroundQuery: false;
        readonly chatType: "private";
    };
    /** An inline result in the list, before it is sent: data, no input, nothing about the user. */
    readonly preview: {
        readonly isCopy: false;
        readonly canQuery: false;
        readonly backgroundQuery: false;
        readonly chatType: "private";
        readonly preview: true;
    };
};
export type WidgetMessageKind = keyof typeof WIDGET_MESSAGE_KINDS;
/**
 * A viewer written as `id,first,last,username,premium` (the harness's `--viewer`, the dev app's `?viewer=`): empty
 * parts are absent, `premium` is any of `1`, `true`, `premium`; no positive id → null. Unchecked: the host checks it.
 */
export declare function viewerFromList(list: string): WidgetViewer | null;
/** What a key the client did not pass falls back to. Clients pass every key (docs/sdk-v1.md §5.1). */
export declare const DEFAULT_THEME_PARAMS: Record<'light' | 'dark', ThemeParams>;
export declare function completeThemeParams(params: unknown, scheme: 'light' | 'dark'): ThemeParams;
/** The client's own `<button>` (docs/sdk-v1.md §2.4); every field optional, the template's defaults stand for the rest. */
export interface ButtonTokens {
    bg?: string;
    text?: string;
    radius?: string;
    font?: string;
    padding?: string;
    height?: string;
    pressedOpacity?: number | string;
    disabledOpacity?: number | string;
}
/**
 * The client's message text (docs/sdk-v1.md §2.4): the root's font size (the chat's text-size setting, in CSS px),
 * its line height (unitless) and the padding between the bubble's edge and the widget's content; every field
 * optional, the reference set (`DEFAULT_TEXT_TOKENS`) stands for the rest.
 */
export interface TextTokens {
    fontSize?: number | string;
    lineHeight?: number | string;
    padding?: string;
}
/** The reference text tokens: what a client on defaults gets, and what every reference picture is drawn with. */
export declare const DEFAULT_TEXT_TOKENS: {
    readonly fontSize: "15px";
    readonly lineHeight: "1.35";
    readonly padding: "8px 12px";
};
/** What the host passes to the renderer: the colour scheme, the palette, the button and text tokens. */
export interface WidgetTheme {
    colorScheme: 'light' | 'dark';
    params?: Partial<ThemeParams>;
    button?: ButtonTokens;
    text?: TextTokens;
}
/**
 * The client's chrome over the widget, in logical px (docs/sdk-v1.md §2.17): a widget with no caption below it gets the
 * message time and status drawn over its bottom corner, as on a photo. `bottom` is the height of the time's band;
 * `cornerLeft` / `cornerRight` the width of the client's corner in that band, on a physical side (right in a
 * left-to-right interface, left in a right-to-left one, the other 0); `top`, `left` and `right` are 0. All 0 with a
 * caption below it (the time is in the caption's line; a caption shown above it, `invert_media`, is as none) and on a
 * client that draws nothing over the widget.
 */
export interface ContentSafeArea {
    top: number;
    right: number;
    bottom: number;
    left: number;
    cornerLeft: number;
    cornerRight: number;
}
export declare const CONTENT_SAFE_AREA_FIELDS: readonly ["top", "right", "bottom", "left", "cornerLeft", "cornerRight"];
/** The largest inset (`top`, `right`, `bottom`, `left`) and corner a client may pass; a value outside 0…max is 0. */
export declare const MAX_SAFE_AREA_INSET = 64;
export declare const MAX_SAFE_AREA_CORNER = 200;
/** No chrome over the widget: what every host has until the client passes its own. */
export declare const NO_CONTENT_SAFE_AREA: Readonly<ContentSafeArea>;
/** Every field a finite number of logical px in its range (insets 0–64, corners 0–200), at most two decimals; anything else is 0. */
export declare function checkContentSafeArea(area: unknown): ContentSafeArea;
/**
 * The `env()` names the validator rewrites to the root variable the renderer sets (docs/sdk-v1.md §2.17):
 * `env(safe-area-inset-bottom, 8px)` → `var(--tg-content-safe-area-inset-bottom, 8px)`. Exact names, as in CSS.
 */
export declare const SAFE_AREA_ENV_VARIABLES: Readonly<Record<string, string>>;
/** The CSS variables of a content safe area (checked; every one always set, `0px` for none). */
export declare function contentSafeAreaVariables(area: unknown): Record<string, string>;
/** Every variable name the renderer may set on the widget's root: the theme's and the content safe area's. */
export declare const THEME_VARIABLES: readonly string[];
/**
 * The CSS variables of a theme (docs/sdk-v1.md §2.3, §2.4, §3.4): names from the fixed list, values that match their
 * grammar. The palette and the text tokens are always complete (the scheme's defaults, `DEFAULT_TEXT_TOKENS`); a
 * button token is set only when the client passed it (the template's default stands for it).
 */
export declare function themeVariables(theme: unknown): Record<string, string>;
/** A host's `theme` option: a plain scheme (the API before v1) or a WidgetTheme, with its palette checked. */
export declare function toWidgetTheme(theme: unknown): WidgetTheme & {
    params: Partial<ThemeParams>;
};
