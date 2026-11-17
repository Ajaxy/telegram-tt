import { type HostToRenderer, type RendererToHost } from '../shared/protocol';
/** Where the core renders: a whole document (iframe, native WebViews) or a shadow root inside the host page. */
export interface RendererEnv {
    /** Element factory. */
    doc: Document;
    /** Listener target and `elementFromPoint`: the document or the shadow root. */
    root: Document | ShadowRoot;
    /** The widget's <html>, <head>, <body>: the document's own, or three elements the shadow renderer created. Read at `init()` (a document's body does not exist while its <head> script runs). */
    roots(): {
        html: HTMLElement;
        head: HTMLElement;
        body: HTMLElement;
    };
    /** Origin of the widget's coordinate space in the root's viewport, or null when they coincide (a document). */
    origin(): {
        x: number;
        y: number;
    } | null;
    viewport(): {
        innerWidth: number;
        innerHeight: number;
        dpr: number;
    };
    /** Height of the laid-out widget, used to auto-size the bubble. */
    docHeight(): number;
    matchMedia(query: string): boolean;
    /** Fires when the widget's viewport changes size; returns the unsubscribe. */
    onViewportResize(cb: () => void): () => void;
    /** Fires when the OS colour scheme changes under the renderer (the host re-asserts its theme); returns the unsubscribe. */
    onColorSchemeChange(cb: () => void): () => void;
    /**
     * The element that stands for the canvas when the widget's <html> is not a document root (the shadow renderer's
     * host): the core paints on it what CSS paints on a document's canvas, the root's background or else the body's
     * (root background propagation). A document has a canvas of its own: undefined.
     */
    canvas?: HTMLElement;
    /**
     * A frame inside a page (the web's IframeRenderer, whose element carries the theme's scheme): give the frame's root the
     * same scheme, or the frame gets an opaque canvas in the root's scheme over the bubble behind the transparent renderer.
     * Not in a WebView: a dark root there paints a dark canvas of its own.
     */
    frameColorScheme?(scheme: 'light' | 'dark'): void;
    /**
     * A client that draws emoji as images (its system font has none, or other ones): `text` as runs of text and emoji
     * images, or undefined when it has no emoji. Undefined: the system font draws them (local patch, NOTICE.md).
     */
    emoji?(text: string): (string | {
        src: string;
        text: string;
    })[] | undefined;
}
export type Send = (msg: RendererToHost, transfer: Transferable[]) => void;
export interface RendererCore {
    /** Starts listening and reporting; `send` carries renderer → host messages. */
    init(send: Send): void;
    onMessage(msg: HostToRenderer): void;
    destroy(): void;
}
export declare function toBase64(buf: ArrayBuffer): string;
export declare function createRenderer(env: RendererEnv): RendererCore;
